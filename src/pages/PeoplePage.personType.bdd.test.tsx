/**
 * PeoplePage — one classification input (Pulse task b1178b3f).
 *
 * Add/Edit Person used to ask for both "Type" (Employee/Contractor) and
 * "Employment Type", which could contradict each other. Now Employment Type is
 * the only input and the person type is derived from it on save.
 */
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

vi.mock('../services/leaveConfigService', () => ({
  leaveConfigApi: { getForEmploymentType: vi.fn(), setPersonOverride: vi.fn() },
}));

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn(), create: vi.fn() },
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
import { customFieldDefsApi, personCustomFieldsApi } from '../services/customFieldsService';
import { leaveConfigApi } from '../services/leaveConfigService';
import { leaveTypesApi } from '../services/leaveTypesService';

const mockPeopleApi = peopleApi as any;
const mockMastersApi = mastersApi as any;

const EMPLOYMENT_TYPES = [
  { id: 'et-ft', code: 'full_time', name: 'Full Time' },
  { id: 'et-fl', code: 'freelancer', name: 'Freelancer' },
];

const basePerson = {
  id: 'p1',
  full_name: 'Alice Smith',
  email: 'alice@test.com',
  job_title: 'Engineer',
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
  mockPeopleApi.getAll.mockResolvedValue({ data: [basePerson], total: 1 });
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockPeopleApi.getLaborCategoryOptions.mockResolvedValue([]);
  mockPeopleApi.create.mockResolvedValue({ id: 'new-1' });
  mockPeopleApi.update.mockResolvedValue({ id: 'p1' });
  (departmentsApi as any).getTree.mockResolvedValue([]);
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
  mockMastersApi.getAll.mockImplementation((kind: string) =>
    Promise.resolve({ data: kind === 'employment_type' ? EMPLOYMENT_TYPES : [] }),
  );
  (customFieldDefsApi as any).getAll.mockResolvedValue({ data: [] });
  (personCustomFieldsApi as any).getForPerson.mockResolvedValue({ data: [] });
  (personCustomFieldsApi as any).setForPerson.mockResolvedValue({ data: [] });
  (leaveConfigApi as any).getForEmploymentType.mockResolvedValue({ configured: false, leave_types: [] });
  (leaveTypesApi as any).getAll.mockResolvedValue({ data: [] });
});

const employmentTypeSelect = (id: string) => document.getElementById(id) as HTMLSelectElement;
/** Queries scoped to the modal's form — the registry list behind it has its own Type filter. */
const inForm = (id: string) => within(employmentTypeSelect(id).closest('form')!);

// ============================================================================
describe('Given the Add Person form', () => {
  const openCreate = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(employmentTypeSelect('create-employment-type')).toBeInTheDocument());
    await waitFor(() =>
      expect(within(employmentTypeSelect('create-employment-type')).getByRole('option', { name: 'Freelancer' })).toBeInTheDocument(),
    );
  };

  const fillAndSubmit = async (employmentTypeCode?: string) => {
    const name = screen.getByPlaceholderText('John Doe');
    fireEvent.change(name, { target: { value: 'New Hire' } });
    fireEvent.click(screen.getByText('Employee Only (No System Access)'));
    if (employmentTypeCode) {
      fireEvent.change(employmentTypeSelect('create-employment-type'), { target: { value: employmentTypeCode } });
    }
    fireEvent.submit(name.closest('form')!);
    await waitFor(() => expect(mockPeopleApi.create).toHaveBeenCalled());
    return mockPeopleApi.create.mock.calls[0][0];
  };

  it('When it opens / Then there is no separate Type field — Employment Type is the only classification input, visible without expanding anything', async () => {
    await openCreate();

    expect(inForm('create-employment-type').queryByText('Type *')).not.toBeInTheDocument();
    expect(inForm('create-employment-type').queryByRole('option', { name: 'Contractor' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Employment Type', { selector: '#create-employment-type' })).toBeVisible();
  });

  it('When nothing is selected / Then the form says the person will be recorded as an Employee', async () => {
    await openCreate();

    expect(inForm('create-employment-type').getByTestId('derived-person-type')).toHaveTextContent('Recorded as Employee');
  });

  it('When Freelancer is selected / Then the form says Contractor', async () => {
    await openCreate();

    fireEvent.change(employmentTypeSelect('create-employment-type'), { target: { value: 'freelancer' } });

    expect(inForm('create-employment-type').getByTestId('derived-person-type')).toHaveTextContent('Recorded as Contractor');
  });

  it('When saved as Freelancer / Then the person is created as a contractor with that employment type', async () => {
    await openCreate();

    const payload = await fillAndSubmit('freelancer');

    expect(payload).toEqual(expect.objectContaining({ employment_type: 'freelancer', type: 'contractor' }));
  });

  it('When saved as Full Time / Then the person is created as an employee', async () => {
    await openCreate();

    const payload = await fillAndSubmit('full_time');

    expect(payload).toEqual(expect.objectContaining({ employment_type: 'full_time', type: 'employee' }));
  });

  it('When saved with no employment type / Then the person is created as an employee', async () => {
    await openCreate();

    const payload = await fillAndSubmit();

    expect(payload.type).toBe('employee');
  });
});

// ============================================================================
describe('Given the Edit Person form', () => {
  const openEdit = async (person: Record<string, unknown>) => {
    mockPeopleApi.getAll.mockResolvedValue({ data: [person], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Employee actions'));
    fireEvent.click(screen.getByText('Edit Employee'));
    await waitFor(() => expect(screen.getByText('Edit Alice Smith')).toBeInTheDocument());
    await waitFor(() =>
      expect(within(employmentTypeSelect('edit-employment-type')).getByRole('option', { name: 'Freelancer' })).toBeInTheDocument(),
    );
  };

  const save = async () => {
    fireEvent.submit(employmentTypeSelect('edit-employment-type').closest('form')!);
    await waitFor(() => expect(mockPeopleApi.update).toHaveBeenCalled());
    return mockPeopleApi.update.mock.calls[0][1];
  };

  it('When it opens / Then there is no separate Type field', async () => {
    await openEdit(basePerson);

    expect(inForm('edit-employment-type').queryByRole('option', { name: 'Contractor' })).not.toBeInTheDocument();
    expect(inForm('edit-employment-type').queryByText('Type')).not.toBeInTheDocument();
  });

  it('When an employee is switched to Freelancer and saved / Then they are saved as a contractor', async () => {
    await openEdit({ ...basePerson, employment_type: 'full_time' });

    fireEvent.change(employmentTypeSelect('edit-employment-type'), { target: { value: 'freelancer' } });
    expect(inForm('edit-employment-type').getByTestId('derived-person-type')).toHaveTextContent('Recorded as Contractor');

    expect(await save()).toEqual(expect.objectContaining({ employment_type: 'freelancer', type: 'contractor' }));
  });

  it('When a contractor with no employment type is saved / Then their stored type is kept, not flipped to employee', async () => {
    await openEdit({ ...basePerson, type: 'contractor' });

    expect(inForm('edit-employment-type').getByTestId('derived-person-type')).toHaveTextContent('Recorded as Contractor');
    expect((await save()).type).toBe('contractor');
  });

  it('When a contractor is given a Full Time employment type / Then they are saved as an employee', async () => {
    await openEdit({ ...basePerson, type: 'contractor' });

    fireEvent.change(employmentTypeSelect('edit-employment-type'), { target: { value: 'full_time' } });

    expect(inForm('edit-employment-type').getByTestId('derived-person-type')).toHaveTextContent('Recorded as Employee');
    expect((await save()).type).toBe('employee');
  });
});
