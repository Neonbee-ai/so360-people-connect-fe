/**
 * PeoplePage — Leave Configuration wiring in the Add Person flow.
 *
 * BDD specs locking in Pulse task fda3e874: HR/Admin must be able to configure
 * an employee's applicable leave structure (employment-type defaults +
 * per-employee include/exclude overrides) as part of person CREATION, not only
 * after the fact from the employee's profile.
 *
 * `PersonLeaveConfigSection` is rendered inside `CreatePersonModal` and stages
 * overrides in local state. They cannot be written until the person row
 * exists (the override API is keyed by person_id), so the section's selections
 * are carried on the submitted payload and applied by `handleCreate` via
 * sequential `leaveConfigApi.setPersonOverride` calls immediately after
 * `peopleApi.create` resolves — mirroring the custom-fields wiring pattern in
 * `PeoplePage.customFields.spec.tsx`.
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
  workLocationsApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../services/mastersService', () => ({
  mastersApi: { getAll: vi.fn() },
}));

vi.mock('../services/customFieldsService', () => ({
  customFieldDefsApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  personCustomFieldsApi: { getForPerson: vi.fn(), setForPerson: vi.fn().mockResolvedValue({ data: [] }) },
  CHOICE_FIELD_TYPES: ['dropdown', 'multi_select'],
}));

vi.mock('../services/leaveConfigService', () => ({
  leaveConfigApi: {
    getForEmploymentType: vi.fn(),
    setPersonOverride: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    cancelInvite: vi.fn(),
    export: vi.fn(),
    getOrgRoles: vi.fn().mockResolvedValue({ data: [] }),
    inviteUser: vi.fn().mockResolvedValue({ invite_link: null, invite_status: 'existing_user', user_id: 'u1', email_sent: false }),
    getLaborCategoryOptions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn().mockResolvedValue([]) },
}));

const { mockRefreshQuota } = vi.hoisted(() => ({ mockRefreshQuota: vi.fn(async () => {}) }));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: mockRefreshQuota }),
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
import { leaveConfigApi } from '../services/leaveConfigService';
import { leaveTypesApi } from '../services/leaveTypesService';
import { customFieldDefsApi, personCustomFieldsApi } from '../services/customFieldsService';

const mockPeopleApi = peopleApi as any;
const mockDepartmentsApi = departmentsApi as any;
const mockWorkLocationsApi = workLocationsApi as any;
const mockMastersApi = mastersApi as any;
const mockLeaveConfigApi = leaveConfigApi as any;
const mockLeaveTypesApi = leaveTypesApi as any;
const mockDefsApi = customFieldDefsApi as any;
const mockValuesApi = personCustomFieldsApi as any;

const renderPage = () => render(<MemoryRouter><PeoplePage /></MemoryRouter>);

const mockPerson = {
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

const fullTimeType = { id: 'et-full', code: 'full_time', name: 'Full Time' };

const defaultEmploymentTypeConfig = {
  configured: true,
  leave_types: [
    { id: 'lt-annual', code: 'ANNUAL', name: 'Annual Leave', is_paid: true, accrual_type: 'annual', max_days_per_year: 20, color: '#22c55e', source: 'employment_type' },
    { id: 'lt-sick', code: 'SICK', name: 'Sick Leave', is_paid: true, accrual_type: 'annual', max_days_per_year: 10, color: '#f97316', source: 'employment_type' },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockPeopleApi.getLaborCategoryOptions.mockResolvedValue([]);
  mockPeopleApi.update.mockResolvedValue({ id: 'p1' });
  mockPeopleApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  mockDepartmentsApi.getTree.mockResolvedValue([]);
  mockWorkLocationsApi.getAll.mockResolvedValue({ data: [] });
  mockMastersApi.getAll.mockImplementation((kind: string) => {
    if (kind === 'employment_type') return Promise.resolve({ data: [fullTimeType] });
    return Promise.resolve({ data: [] });
  });
  mockLeaveConfigApi.getForEmploymentType.mockResolvedValue(defaultEmploymentTypeConfig);
  mockLeaveConfigApi.setPersonOverride.mockResolvedValue({});
  // resetAllMocks() above clears the module-level defaults set in vi.mock() —
  // PeoplePage loads custom field definitions on mount (create modal) and on
  // Edit open, same as PeoplePage.customFields.spec.tsx.
  mockDefsApi.getAll.mockResolvedValue({ data: [] });
  mockValuesApi.getForPerson.mockResolvedValue({ data: [] });
  mockValuesApi.setForPerson.mockResolvedValue({ data: [] });
  mockLeaveTypesApi.getAll.mockResolvedValue({
    data: [
      { id: 'lt-annual', name: 'Annual Leave' },
      { id: 'lt-sick', name: 'Sick Leave' },
      { id: 'lt-bereavement', name: 'Bereavement Leave' },
    ],
  });
});

const openCreateModal = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Add Person'));
  await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
};

const fillMinimalPersonAndSelectEmploymentType = async () => {
  const nameInput = screen.getByPlaceholderText('John Doe');
  fireEvent.change(nameInput, { target: { value: 'New Hire' } });
  await waitFor(() => expect(nameInput).toHaveValue('New Hire'));

  // "Employment Details" and "Leave Configuration" are separate, independent
  // accordions (Section defaultOpen=false) — neither's content is in the DOM
  // at all until each is expanded.
  fireEvent.click(screen.getByText('Employment Details'));
  fireEvent.click(screen.getByText('Leave Configuration'));

  // "Employee Only" — the default invite mode requires an email + role, which
  // these leave-config scenarios are not about.
  fireEvent.click(screen.getByText('Employee Only (No System Access)'));

  const employmentTypeSelect = await screen.findByDisplayValue('Select Employment Type');
  fireEvent.change(employmentTypeSelect, { target: { value: 'full_time' } });
  await waitFor(() => expect(mockLeaveConfigApi.getForEmploymentType).toHaveBeenCalledWith('et-full'));

  return nameInput;
};

// ============================================================================
// 1. Leave Configuration section renders WITHIN the create-person flow
// ============================================================================
describe('Given the Add Person modal is open', () => {
  it('When an Employment Type is selected / Then the Leave Configuration section shows its inherited defaults, still inside the create modal', async () => {
    await openCreateModal();
    await fillMinimalPersonAndSelectEmploymentType();

    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    expect(screen.getByText('Sick Leave')).toBeInTheDocument();
    // Still the create modal — not a navigation to the person's profile.
    expect(screen.getByText('Add New Person')).toBeInTheDocument();
  });
});

// ============================================================================
// 2. Creating a person with the DEFAULT leave structure (no customization)
// ============================================================================
describe('Given an employment type with configured default leave types', () => {
  it('When a person is created without customizing leave / Then peopleApi.create is called with no leaveOverrides and setPersonOverride is never called', async () => {
    mockPeopleApi.create.mockResolvedValue({ id: 'new-person-1' });
    await openCreateModal();
    const nameInput = await fillMinimalPersonAndSelectEmploymentType();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());

    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(mockPeopleApi.create).toHaveBeenCalled());
    // leaveOverrides must not leak into the person create payload itself.
    expect(mockPeopleApi.create.mock.calls[0][0]).not.toHaveProperty('leaveOverrides');
    expect(mockLeaveConfigApi.setPersonOverride).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 3. Creating a person with a CUSTOM leave-type selection
// ============================================================================
describe('Given an HR admin customizes leave for this employee during creation', () => {
  it('When an inherited type is removed and a new one is added, then the person is created / Then setPersonOverride is called once per staged override, keyed to the new person id', async () => {
    mockPeopleApi.create.mockResolvedValue({ id: 'new-person-2' });
    await openCreateModal();
    const nameInput = await fillMinimalPersonAndSelectEmploymentType();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Customize for this employee'));

    // Remove the inherited Sick Leave for this employee only.
    const sickLeaveRow = screen.getByText('Sick Leave').closest('li')!;
    fireEvent.click(within(sickLeaveRow).getByText('Remove'));

    // Add Bereavement Leave, which this employment type does not inherit.
    fireEvent.click(screen.getByText('Add Leave Type'));
    await waitFor(() => expect(screen.getByText('Select a leave type…')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('Select a leave type…'), { target: { value: 'lt-bereavement' } });

    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(mockPeopleApi.create).toHaveBeenCalled());
    expect(mockPeopleApi.create.mock.calls[0][0]).not.toHaveProperty('leaveOverrides');

    await waitFor(() => expect(mockLeaveConfigApi.setPersonOverride).toHaveBeenCalledWith('new-person-2', 'lt-sick', 'exclude'));
    expect(mockLeaveConfigApi.setPersonOverride).toHaveBeenCalledWith('new-person-2', 'lt-bereavement', 'include');
    expect(mockLeaveConfigApi.setPersonOverride).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// 4. Persistence after creation — a failed override write does not read as a
//    failed person creation
// ============================================================================
describe('Given the person is created successfully but the leave override write fails', () => {
  it('When setPersonOverride rejects / Then the person is still created and the modal still closes', async () => {
    mockPeopleApi.create.mockResolvedValue({ id: 'new-person-3' });
    mockLeaveConfigApi.setPersonOverride.mockRejectedValue(new Error('network error'));

    await openCreateModal();
    const nameInput = await fillMinimalPersonAndSelectEmploymentType();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Customize for this employee'));
    const sickLeaveRow = screen.getByText('Sick Leave').closest('li')!;
    fireEvent.click(within(sickLeaveRow).getByText('Remove'));

    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(mockPeopleApi.create).toHaveBeenCalled());
    await waitFor(() => expect(mockLeaveConfigApi.setPersonOverride).toHaveBeenCalled());
    // The create modal closes regardless — creation itself succeeded.
    await waitFor(() => expect(screen.queryByText('Add New Person')).not.toBeInTheDocument());
  });
});

// ============================================================================
// 5. Validation — no Employment Type selected yet
// ============================================================================
describe('Given no Employment Type has been selected in the create modal', () => {
  it('When the Leave Configuration section renders / Then it prompts to select an Employment Type instead of showing leave types', async () => {
    await openCreateModal();
    // Leave Configuration is its own collapsed-by-default accordion — its
    // content isn't in the DOM until expanded.
    fireEvent.click(screen.getByText('Leave Configuration'));
    expect(screen.getByText('Select an Employment Type to load the default leave structure.')).toBeInTheDocument();
    expect(mockLeaveConfigApi.getForEmploymentType).not.toHaveBeenCalled();
  });
});
