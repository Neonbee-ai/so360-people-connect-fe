import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();
const flags = vi.hoisted(() => ({ disabled: new Set<string>() }));

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
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: (key: string) => !flags.disabled.has(key), isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
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
import { toast } from '@so360/design-system';

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

const openAddPerson = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /add person/i }));
  await waitFor(() => expect(screen.getByLabelText('Full Name *')).toBeInTheDocument());
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  flags.disabled.clear();
  mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  mockApi.getOrgRoles.mockResolvedValue({ data: [{ id: 'role-1', name: 'Employee' }] });
  mockApi.getLaborCategoryOptions.mockResolvedValue([]);
  mockApi.create.mockResolvedValue({ id: 'p2' });
  mockApi.inviteUser.mockResolvedValue({ invite_status: 'existing_user' });
  (departmentsApi as any).getTree.mockResolvedValue([]);
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (mastersApi as any).getAll.mockResolvedValue({ data: [] });
  (customFieldDefsApi as any).getAll.mockResolvedValue({ data: [] });
  (fetchOrgBaseCurrency as any).mockResolvedValue('USD');
});

describe('Given the People Registry on the Comb list template', () => {
  it('When the page loads / Then the template title and the Add Person primary action are shown', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'People Registry' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add person/i })).toBeInTheDocument();
  });

  it('When the people request is still pending / Then the template shows its loading status and no rows', () => {
    mockApi.getAll.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });

  it('When the org has no people / Then the empty state invites adding the first person', async () => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    expect(await screen.findByText('No people found')).toBeInTheDocument();
    expect(screen.getByText('Add First Person')).toBeInTheDocument();
  });

  it('When a new person is submitted from the Add Person drawer / Then peopleApi.create receives the entered identity', async () => {
    await openAddPerson();
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: '  Henry Ford  ' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'henry@ford.com' } });
    fireEvent.change(screen.getByLabelText('Invitation role'), { target: { value: 'role-1' } });

    const submit = within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Person' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(mockApi.create).toHaveBeenCalledTimes(1));
    expect(mockApi.create.mock.calls[0][0]).toMatchObject({ full_name: 'Henry Ford', email: 'henry@ford.com' });
  });

  it('When the create flag is off / Then the Add Person action is hidden', async () => {
    flags.disabled.add('action:people:employees:create');
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /add person/i })).not.toBeInTheDocument();
  });

  it('When peopleApi.create fails / Then an error toast is raised and the drawer stays open', async () => {
    const toastError = vi.spyOn(toast, 'error');
    mockApi.create.mockRejectedValue(new Error('boom'));
    await openAddPerson();
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'Henry Ford' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'henry@ford.com' } });
    fireEvent.change(screen.getByLabelText('Invitation role'), { target: { value: 'role-1' } });

    const submit = within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Person' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to create person'));
    expect(screen.getByLabelText('Full Name *')).toBeInTheDocument();
  });
});
