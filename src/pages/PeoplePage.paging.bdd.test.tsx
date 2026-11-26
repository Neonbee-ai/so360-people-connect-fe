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

const makePeople = (n: number) => Array.from({ length: n }, (_, i) => ({ ...mockPerson, id: `p${i}`, full_name: `Person ${i}`, email: `p${i}@test.com` }));

describe('Given the People directory is server-paged', () => {
  it('When the page loads / Then it asks for page 1 with limit 50', async () => {
    renderPage();
    await waitFor(() => expect(mockApi.getAll).toHaveBeenCalled());
    expect(mockApi.getAll.mock.calls[0][0]).toMatchObject({ page: 1, limit: 50 });
  });

  it('When meta.total exceeds a page / Then pagination shows the server total and the next page is requested on Next', async () => {
    mockApi.getAll.mockResolvedValue({ data: makePeople(50), meta: { total: 120, page: 1, limit: 50 } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(mockApi.getAll.mock.calls.some((c: any[]) => c[0].page === 2)).toBe(true));
  });

  it('When the backend ignores paging and returns every row / Then rows are paged on screen without refetching', async () => {
    mockApi.getAll.mockResolvedValue({ data: makePeople(120) });
    renderPage();
    await waitFor(() => expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument());
    expect(screen.queryByText('Person 60')).not.toBeInTheDocument();
    expect(mockApi.getAll).toHaveBeenCalledTimes(1);
  });

  it('When the response has no meta and fewer rows than a page / Then it is a single page', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
  });
});
