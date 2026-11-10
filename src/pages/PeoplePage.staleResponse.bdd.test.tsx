import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn() },
}));

vi.mock('../services/mastersService', () => ({
  mastersApi: { getAll: vi.fn() },
}));

vi.mock('../services/customFieldsService', () => ({
  customFieldDefsApi: { getAll: vi.fn() },
  personCustomFieldsApi: { getForPerson: vi.fn(), setForPerson: vi.fn() },
  CHOICE_FIELD_TYPES: ['dropdown', 'multi_select'],
}));

vi.mock('../services/settingsService', () => ({
  fetchOrgBaseCurrency: vi.fn().mockResolvedValue('USD'),
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    cancelInvite: vi.fn(),
    export: vi.fn(),
    getOrgRoles: vi.fn(),
    inviteUser: vi.fn(),
    getLaborCategoryOptions: vi.fn(),
  },
  apiContext: { getBaseUrl: vi.fn(() => '/people-api') },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

vi.mock('../hooks/useShellContext', () => ({
  usePeopleContext: () => ({ orgId: 'o1', tenantId: 't1', userId: 'u1' }),
}));

vi.mock('../services/apiClient', () => ({
  apiContext: { getBaseUrl: vi.fn(() => '/people-api') },
}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    // Date-only primitives — this factory is a CLOSED LIST, so a component that
    // adopts formatters.businessToday()/toBusinessDate() throws here otherwise.
    toBusinessDate: (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)),
    businessToday: () => '2026-09-15',
    startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`),
    endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

import PeoplePage from './PeoplePage';
import { peopleApi } from '../services/peopleService';
import { departmentsApi } from '../services/departmentsService';
import { workLocationsApi } from '../services/workLocationsService';
import { mastersApi } from '../services/mastersService';
import { customFieldDefsApi } from '../services/customFieldsService';
import { fetchOrgBaseCurrency } from '../services/settingsService';

const mockApi = peopleApi as any;

const mockPerson = {
  id: 'p1',
  full_name: 'Alice Smith',
  email: 'alice@test.com',
  job_title: 'Engineer',
  department: 'Engineering',
  type: 'employee',
  status: 'active',
  cost_rate: 100,
  cost_rate_unit: 'hour',
  currency: 'USD',
  available_hours_per_day: 8,
  available_days_per_week: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const renderPage = () => render(<MemoryRouter><PeoplePage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  mockApi.getOrgRoles.mockResolvedValue({ data: [{ id: 'role-1', name: 'Employee' }] });
  mockApi.getLaborCategoryOptions.mockResolvedValue([]);
  mockApi.create.mockResolvedValue({ id: 'p2' });
  mockApi.inviteUser.mockResolvedValue({ invite_status: 'existing_user' });
  (departmentsApi as any).getTree.mockResolvedValue([]);
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (mastersApi as any).getAll.mockResolvedValue({ data: [] });
  (customFieldDefsApi as any).getAll.mockResolvedValue({ data: [] });
  // resetAllMocks() clears implementations declared in the vi.mock factories.
  (fetchOrgBaseCurrency as any).mockResolvedValue('USD');
});

describe('Given the People list reloads when the search filter changes', () => {
  it('When an older slow response arrives after the newer one / Then the newer rows stay and the spinner is not left on stale data', async () => {
    const fresh = { ...mockPerson, id: 'p9', full_name: 'Bob Newer' };
    const stale = { ...mockPerson, id: 'p8', full_name: 'Zed Stale' };
    let resolveFirst: (v: any) => void = () => {};
    mockApi.getAll
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce({ data: [fresh], total: 1 });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'bob' } });
    await waitFor(() => expect(screen.getByText('Bob Newer')).toBeInTheDocument());
    resolveFirst({ data: [stale], total: 1 });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('Bob Newer')).toBeInTheDocument();
    expect(screen.queryByText('Zed Stale')).not.toBeInTheDocument();
  });
});
