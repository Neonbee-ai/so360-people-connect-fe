/**
 * PeoplePage — Employee Custom Fields wiring.
 *
 * BDD specs for the one piece of real cross-module wiring in this feature:
 * the Add/Edit Person modal renders one input per active custom field
 * definition, loads the person's current values on edit, and submits them
 * via the values endpoint alongside the person write.
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
  workLocationsApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
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
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
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

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  // resetAllMocks() above clears the module-level default; the Edit modal loads
  // labor categories on open.
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

// ============================================================================
// Create modal — renders one input per active custom field
// ============================================================================
describe('Given active custom field definitions when adding a Person', () => {
  beforeEach(() => {
    mockDefsApi.getAll.mockResolvedValue({
      data: [
        { id: 'def-text', field_key: 'blood_group', label: 'Blood Group', field_type: 'text', options: null, is_required: false, is_active: true, sort_order: 0 },
        { id: 'def-dropdown', field_key: 'vehicle_type', label: 'Vehicle Type', field_type: 'dropdown', options: ['Car', 'Bike'], is_required: false, is_active: true, sort_order: 1 },
      ],
    });
  });

  const openCreateModal = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
  };

  it('When the modal opens / Then one input is rendered per active custom field def', async () => {
    await openCreateModal();
    await waitFor(() => expect(screen.getByText('Blood Group')).toBeInTheDocument());
    expect(screen.getByText('Vehicle Type')).toBeInTheDocument();
    expect(screen.getByText('Select Vehicle Type')).toBeInTheDocument();
  });

  it('When custom field values are filled and the person is created / Then personCustomFieldsApi.setForPerson is called with the new person id and entries', async () => {
    mockPeopleApi.create.mockResolvedValue({ id: 'new-person-1' });
    await openCreateModal();
    await waitFor(() => expect(screen.getByText('Blood Group')).toBeInTheDocument());

    const nameInput = screen.getByPlaceholderText('John Doe');
    fireEvent.change(nameInput, { target: { value: 'New Hire' } });
    await waitFor(() => expect(nameInput).toHaveValue('New Hire'));

    const bloodGroupField = screen.getByTestId('custom-field-def-text');
    fireEvent.change(bloodGroupField.querySelector('input')!, { target: { value: 'O+' } });

    const vehicleTypeField = screen.getByTestId('custom-field-def-dropdown');
    fireEvent.change(vehicleTypeField.querySelector('select')!, { target: { value: 'Car' } });

    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(mockPeopleApi.create).toHaveBeenCalled());
    // customFieldValues must not leak into the person create payload itself.
    expect(mockPeopleApi.create.mock.calls[0][0]).not.toHaveProperty('customFieldValues');

    await waitFor(() => expect(mockValuesApi.setForPerson).toHaveBeenCalledWith(
      'new-person-1',
      expect.arrayContaining([
        { field_def_id: 'def-text', value: 'O+' },
        { field_def_id: 'def-dropdown', value: 'Car' },
      ]),
    ));
  });

  it('When no custom field values are filled / Then personCustomFieldsApi.setForPerson is not called', async () => {
    mockPeopleApi.create.mockResolvedValue({ id: 'new-person-2' });
    await openCreateModal();
    await waitFor(() => expect(screen.getByText('Blood Group')).toBeInTheDocument());

    const nameInput = screen.getByPlaceholderText('John Doe');
    fireEvent.change(nameInput, { target: { value: 'No Custom Values' } });
    await waitFor(() => expect(nameInput).toHaveValue('No Custom Values'));

    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(mockPeopleApi.create).toHaveBeenCalled());
    expect(mockValuesApi.setForPerson).not.toHaveBeenCalled();
  });
});

describe('Given no active custom field definitions exist', () => {
  beforeEach(() => {
    mockDefsApi.getAll.mockResolvedValue({ data: [] });
  });

  it('When the create modal opens / Then no Custom Fields section is rendered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
    expect(screen.queryByTestId('custom-fields-section')).not.toBeInTheDocument();
  });
});

// ============================================================================
// Edit modal — loads existing values, submits changes
// ============================================================================
describe('Given a person with existing custom field values when editing', () => {
  beforeEach(() => {
    mockValuesApi.getForPerson.mockResolvedValue({
      data: [
        { field_def_id: 'def-text', field_key: 'blood_group', label: 'Blood Group', field_type: 'text', options: null, is_required: false, sort_order: 0, value: 'AB+' },
        { field_def_id: 'def-checkbox', field_key: 'is_vaccinated', label: 'Vaccinated', field_type: 'checkbox', options: null, is_required: false, sort_order: 1, value: true },
      ],
    });
  });

  const openEditModal = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Employee actions'));
    fireEvent.click(screen.getByText('Edit Employee'));
    await waitFor(() => expect(screen.getByText('Edit Alice Smith')).toBeInTheDocument());
  };

  it('When the edit modal opens / Then it fetches this person\'s custom field values', async () => {
    await openEditModal();
    await waitFor(() => expect(mockValuesApi.getForPerson).toHaveBeenCalledWith('p1'));
  });

  it('When the edit modal opens / Then existing values are pre-filled into their inputs', async () => {
    await openEditModal();
    await waitFor(() => expect(screen.getByDisplayValue('AB+')).toBeInTheDocument());
    const checkbox = screen.getByTestId('custom-field-def-checkbox').querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('When a value is changed and saved / Then personCustomFieldsApi.setForPerson is called with the updated entries', async () => {
    await openEditModal();
    const bloodGroupInput = await screen.findByDisplayValue('AB+');
    fireEvent.change(bloodGroupInput, { target: { value: 'O-' } });

    const form = bloodGroupInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(mockPeopleApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({ full_name: 'Alice Smith' })));
    // customFieldValues must not leak into the person update payload itself.
    expect(mockPeopleApi.update.mock.calls[0][1]).not.toHaveProperty('customFieldValues');

    await waitFor(() => expect(mockValuesApi.setForPerson).toHaveBeenCalledWith(
      'p1',
      expect.arrayContaining([
        { field_def_id: 'def-text', value: 'O-' },
        { field_def_id: 'def-checkbox', value: true },
      ]),
    ));
  });
});
