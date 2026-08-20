/**
 * PeoplePage — Work Location wiring in the Add/Edit Person modals.
 *
 * Covers the three defects this feature had:
 *  1. the "Manage Work Locations" link disappeared as soon as one location
 *     existed, leaving no route to the management page;
 *  2. that link navigated to a path the module router does not serve;
 *  3. only active locations are offered for assignment, but a person already
 *     assigned to a since-deactivated location must not silently lose it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn(),
  },
}));

vi.mock('../services/mastersService', () => ({
  mastersApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../services/customFieldsService', () => ({
  customFieldDefsApi: { getAll: vi.fn() },
  personCustomFieldsApi: { getForPerson: vi.fn(), setForPerson: vi.fn() },
  CHOICE_FIELD_TYPES: ['dropdown', 'multi_select'],
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

const mockPeopleApi = peopleApi as any;
const mockDefsApi = customFieldDefsApi as any;
const mockValuesApi = personCustomFieldsApi as any;
const mockDepartmentsApi = departmentsApi as any;
const mockWorkLocationsApi = workLocationsApi as any;
const mockMastersApi = mastersApi as any;

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

const HQ = { id: 'wl1', name: 'Head Office', location_type: 'office', address: null, is_active: true };

beforeEach(() => {
  vi.resetAllMocks();
  mockNavigate.mockReset();
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockPeopleApi.getLaborCategoryOptions.mockResolvedValue([]);
  mockPeopleApi.update.mockResolvedValue({ id: 'p1' });
  mockPeopleApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  mockDefsApi.getAll.mockResolvedValue({ data: [] });
  mockValuesApi.getForPerson.mockResolvedValue({ data: [] });
  mockValuesApi.setForPerson.mockResolvedValue({ data: [] });
  mockDepartmentsApi.getTree.mockResolvedValue([]);
  mockWorkLocationsApi.getAll.mockResolvedValue({ data: [] });
  mockMastersApi.getAll.mockResolvedValue({ data: [] });
});

const openCreateModal = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Add Person'));
  await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
};

const openEditModal = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Employee actions'));
  fireEvent.click(await screen.findByText('Edit Employee'));
  await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
};

describe('Given the Add Person modal and no work locations configured', () => {
  it('When the modal opens / Then the manage link is offered', async () => {
    await openCreateModal();
    await waitFor(() => expect(screen.getByText('Manage Work Locations')).toBeInTheDocument());
    expect(screen.getByText(/No work locations configured/i)).toBeInTheDocument();
  });
});

describe('Given the Add Person modal and at least one work location configured', () => {
  beforeEach(() => {
    mockWorkLocationsApi.getAll.mockResolvedValue({ data: [HQ] });
  });

  it('When the modal opens / Then the manage link is STILL offered (it used to vanish)', async () => {
    await openCreateModal();
    await waitFor(() => expect(screen.getByText('Head Office')).toBeInTheDocument());
    expect(screen.getByText('Manage Work Locations')).toBeInTheDocument();
  });

  it('When the manage link is clicked on a pristine form / Then it navigates straight through (nothing to lose)', async () => {
    await openCreateModal();
    await waitFor(() => expect(screen.getByText('Manage Work Locations')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Manage Work Locations'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/work-locations');
  });

  it('When the form has data / Then the manage link warns in place instead of silently discarding it', async () => {
    await openCreateModal();
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'New Hire' } });
    fireEvent.click(screen.getByText('Manage Work Locations'));

    // No navigation yet — the warning replaces the help line (no stacked modal).
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText(/Leaving discards/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Leave anyway'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/work-locations');
  });

  it('When the user chooses Stay / Then the form is untouched and no navigation happens', async () => {
    await openCreateModal();
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'New Hire' } });
    fireEvent.click(screen.getByText('Manage Work Locations'));
    fireEvent.click(screen.getByText('Stay'));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('John Doe')).toHaveValue('New Hire');
    expect(screen.getByText('Manage Work Locations')).toBeInTheDocument();
  });

  it('When the modal opens / Then only active locations are offered for assignment', async () => {
    await openCreateModal();
    await waitFor(() => expect(screen.getByText('Head Office')).toBeInTheDocument());
    // The assignment dropdown must never ask for inactive locations.
    expect(mockWorkLocationsApi.getAll).toHaveBeenCalledWith();
  });
});

describe('Given the in-drawer quick-add location flow (no stacked surfaces, no navigation)', () => {
  beforeEach(() => {
    mockWorkLocationsApi.getAll.mockResolvedValue({ data: [HQ] });
  });

  it('When "+ New Location" is clicked / Then the drawer content is replaced — the person form survives hidden, nothing navigates', async () => {
    await openCreateModal();
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'New Hire' } });
    fireEvent.click(screen.getByText('+ New Location'));

    expect(mockNavigate).not.toHaveBeenCalled();
    // Replaced content: quick-add panel with a Back affordance.
    expect(screen.getByText('New Work Location')).toBeInTheDocument();
    expect(screen.getByLabelText('Back')).toBeInTheDocument();
    // The form is still mounted (hidden), so what was typed is not lost.
    expect(screen.getByPlaceholderText('John Doe')).toHaveValue('New Hire');
  });

  it('When the quick location is saved / Then it is created, pre-selected on the person, and the form returns', async () => {
    mockWorkLocationsApi.create.mockResolvedValue({ id: 'wl-new', name: 'Depot 9', location_type: 'store', is_active: true });
    await openCreateModal();
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'New Hire' } });
    fireEvent.click(screen.getByText('+ New Location'));

    const quickName = document.getElementById('quick-location-name') as HTMLInputElement;
    fireEvent.change(quickName, { target: { value: 'Depot 9' } });
    fireEvent.submit(quickName.closest('form')!);

    await waitFor(() => expect(mockWorkLocationsApi.create).toHaveBeenCalledWith({ name: 'Depot 9', location_type: 'office' }));
    // Back on the person form with the new location selected.
    await waitFor(() => expect(screen.queryByText('New Work Location')).not.toBeInTheDocument());
    expect((screen.getByDisplayValue('Depot 9') as HTMLSelectElement)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('John Doe')).toHaveValue('New Hire');
  });

  it('When Back is pressed instead / Then the person form returns untouched with no location created', async () => {
    await openCreateModal();
    fireEvent.click(screen.getByText('+ New Location'));
    fireEvent.click(screen.getByLabelText('Back'));

    expect(mockWorkLocationsApi.create).not.toHaveBeenCalled();
    expect(screen.queryByText('New Work Location')).not.toBeInTheDocument();
    expect(screen.getByText('Select Work Location')).toBeInTheDocument();
  });
});

describe('Given progressive disclosure in the Add Person drawer', () => {
  it('When the drawer opens / Then advanced sections are collapsed and their fields hidden', async () => {
    await openCreateModal();
    // Toggles present…
    expect(screen.getByText('Employment Details')).toBeInTheDocument();
    expect(screen.getByText('Cost & Billing')).toBeInTheDocument();
    expect(screen.getByText('Availability')).toBeInTheDocument();
    // …contents hidden until expanded.
    expect(screen.queryByText('Select Designation')).not.toBeInTheDocument();
    expect(screen.queryByText('Rate Unit')).not.toBeInTheDocument();
    expect(screen.queryByText('Hours/Day')).not.toBeInTheDocument();
  });

  it('When a section is expanded / Then its fields appear', async () => {
    await openCreateModal();
    fireEvent.click(screen.getByText('Cost & Billing'));
    expect(screen.getByText('Rate Unit')).toBeInTheDocument();
  });
});

describe('Given an employee assigned to a since-deactivated work location', () => {
  beforeEach(() => {
    mockPeopleApi.getAll.mockResolvedValue({
      data: [{
        ...mockPerson,
        work_location_id: 'wl-gone',
        work_location: { id: 'wl-gone', name: 'Old Depot' },
      }],
      total: 1,
    });
    mockWorkLocationsApi.getAll.mockResolvedValue({ data: [HQ] });
  });

  it('When their record is edited / Then the old location stays selected and is labelled inactive', async () => {
    await openEditModal();
    await waitFor(() => expect(screen.getByText('Old Depot (inactive)')).toBeInTheDocument());
  });
});
