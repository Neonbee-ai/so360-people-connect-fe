/**
 * PersonDetailPage — coverage gap spec.
 *
 * Covers branches not exercised by PersonDetailPage.spec.tsx and
 * PersonDetailPage.extra.spec.tsx:
 *   - handleAddRole success + failure
 *   - handleRemoveRole failure toast
 *   - loadEmploymentHistory / loadRateHistory / loadGoals error paths
 *   - person with user_id (linked badge, no Link User button)
 *   - person with work_location (location shown in header)
 *   - handleSave with status change (different activity event)
 *   - secondary data partial failure (workLocations rejected)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// vi.hoisted ensures this fn is defined before the vi.mock factory runs (hoisting safety).
const mockRecordActivity = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getById: vi.fn(),
    update: vi.fn(),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    getEmploymentHistory: vi.fn(),
    getRateHistory: vi.fn(),
    linkUser: vi.fn(),
    inviteUser: vi.fn(),
  },
  allocationsApi: { getAll: vi.fn() },
  timeEntriesApi: { getAll: vi.fn() },
}));

vi.mock('../services/goalsService', () => ({
  goalsApi: { getAll: vi.fn() },
  Goal: {},
}));

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn() },
  WorkLocation: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: mockRecordActivity }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
    currentTenant: { id: 'tenant-1' },
    currentOrg: { id: 'org-1' },
    user: { id: 'u1', email: 'a@b.com' },
    accessToken: 'tok',
  }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

import PersonDetailPage from '../pages/PersonDetailPage';
import { peopleApi, allocationsApi, timeEntriesApi } from '../services/peopleService';
import { goalsApi } from '../services/goalsService';
import { workLocationsApi } from '../services/workLocationsService';

const mockPeople = peopleApi as any;
const mockAlloc = allocationsApi as any;
const mockTime = timeEntriesApi as any;
const mockGoals = goalsApi as any;
const mockLoc = workLocationsApi as any;

const basePerson = {
  id: 'p1',
  full_name: 'Alice Smith',
  type: 'employee',
  status: 'active',
  email: 'alice@test.com',
  phone: '+1234567890',
  job_title: 'Developer',
  department: 'Engineering',
  cost_rate: 50,
  cost_rate_unit: 'hour',
  currency: 'USD',
  billing_rate: 75,
  available_hours_per_day: 8,
  start_date: '2024-01-01',
  people_roles: [
    { id: 'r1', role_name: 'Frontend Dev', skill_category: 'Engineering', proficiency: 'expert', is_primary: true },
  ],
  user_id: null as string | null,
};

const renderPage = (id = 'p1') =>
  render(
    <MemoryRouter initialEntries={[`/people/${id}`]}>
      <Routes>
        <Route path="/people/:id" element={<PersonDetailPage />} />
        <Route path="/people" element={<div>People List</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.resetAllMocks();
  mockAlloc.getAll.mockResolvedValue({ data: [] });
  mockTime.getAll.mockResolvedValue({ data: [] });
  mockGoals.getAll.mockResolvedValue({ data: [] });
  mockPeople.getEmploymentHistory.mockResolvedValue([]);
  mockPeople.getRateHistory.mockResolvedValue([]);
  mockLoc.getAll.mockResolvedValue({ data: [] });
  mockRecordActivity.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// handleAddRole paths
// ---------------------------------------------------------------------------

describe('Given a person exists — handleAddRole', () => {
  beforeEach(() => {
    mockPeople.getById.mockResolvedValue({ ...basePerson });
  });

  it('When Add Role modal is submitted successfully / Then addRole is called and role appears', async () => {
    mockPeople.addRole.mockResolvedValue({
      id: 'r2',
      role_name: 'Backend Dev',
      skill_category: 'Engineering',
      proficiency: 'intermediate',
      is_primary: false,
    });

    renderPage();
    await waitFor(() => screen.getByText('Alice Smith'));

    // Open modal (the "Add Role" opener button)
    const addRoleOpener = screen.getAllByText('Add Role')[0];
    fireEvent.click(addRoleOpener);
    await waitFor(() => screen.getByText('Add Role / Skill'));

    // Fill in role name and submit the form
    const roleInput = screen.getByPlaceholderText('e.g., Full Stack Developer');
    fireEvent.change(roleInput, { target: { value: 'Backend Dev' } });
    const form = roleInput.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(mockPeople.addRole).toHaveBeenCalledWith('p1', expect.objectContaining({ role_name: 'Backend Dev' })));
    await waitFor(() => expect(screen.getByText('Role added')).toBeInTheDocument());
  });

  it('When Add Role modal submit fails / Then shows failure toast', async () => {
    mockPeople.addRole.mockRejectedValue(new Error('Role creation failed'));

    renderPage();
    await waitFor(() => screen.getByText('Alice Smith'));

    const addRoleOpener = screen.getAllByText('Add Role')[0];
    fireEvent.click(addRoleOpener);
    await waitFor(() => screen.getByText('Add Role / Skill'));

    const roleInput = screen.getByPlaceholderText('e.g., Full Stack Developer');
    fireEvent.change(roleInput, { target: { value: 'Backend Dev' } });
    const form = roleInput.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText('Failed to add role')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// handleRemoveRole failure
// ---------------------------------------------------------------------------

describe('Given a person exists — handleRemoveRole failure', () => {
  beforeEach(() => {
    mockPeople.getById.mockResolvedValue({ ...basePerson });
    mockPeople.removeRole.mockRejectedValue(new Error('Remove failed'));
  });

  it('When removeRole fails / Then shows failure toast', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Frontend Dev'));

    const trashButton = screen.getByTestId('icon-Trash2').closest('button');
    if (trashButton) fireEvent.click(trashButton);

    await waitFor(() => expect(screen.getByText('Failed to remove role')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Tab data load error paths
// ---------------------------------------------------------------------------

describe('Given a person exists — secondary tab load errors', () => {
  beforeEach(() => {
    mockPeople.getById.mockResolvedValue({ ...basePerson });
  });

  it('When loadEmploymentHistory fails / Then employment history tab shows empty state without crashing', async () => {
    mockPeople.getEmploymentHistory.mockRejectedValue(new Error('History unavailable'));

    renderPage();
    await waitFor(() => screen.getByText('Alice Smith'));
    fireEvent.click(screen.getByText('Employment History'));

    await waitFor(() => expect(screen.getByText('No employment history')).toBeInTheDocument());
  });

  it('When loadRateHistory fails / Then rate history tab shows empty state without crashing', async () => {
    mockPeople.getRateHistory.mockRejectedValue(new Error('Rates unavailable'));

    renderPage();
    await waitFor(() => screen.getByText('Alice Smith'));
    fireEvent.click(screen.getByText('Rate History'));

    await waitFor(() => expect(screen.getByText('No rate history')).toBeInTheDocument());
  });

  it('When loadGoals fails / Then goals tab shows empty state without crashing', async () => {
    mockGoals.getAll.mockRejectedValue(new Error('Goals unavailable'));

    renderPage();
    await waitFor(() => screen.getByText('Alice Smith'));
    fireEvent.click(screen.getByText('Goals'));

    await waitFor(() => expect(screen.getByText('No goals')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Linked-user badge
// ---------------------------------------------------------------------------

describe('Given a person with a linked user account', () => {
  beforeEach(() => {
    mockPeople.getById.mockResolvedValue({ ...basePerson, user_id: 'u-abc' });
  });

  it('When person has user_id / Then shows Linked to user account badge', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Linked to user account')).toBeInTheDocument());
  });

  it('When person has user_id / Then Link User button is not shown', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Linked to user account'));
    expect(screen.queryByText('Link User')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Work location in header
// ---------------------------------------------------------------------------

describe('Given a person with a work location', () => {
  beforeEach(() => {
    mockPeople.getById.mockResolvedValue({
      ...basePerson,
      work_location: { id: 'wl1', name: 'HQ Office', location_type: 'office', is_active: true, org_id: 'o1', tenant_id: 't1', created_at: '', updated_at: '' },
    });
  });

  it('When person has work_location / Then location name is shown in the header', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('HQ Office')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// handleSave with status change activity
// ---------------------------------------------------------------------------

describe('Given a person exists — handleSave with status change', () => {
  beforeEach(() => {
    mockPeople.getById.mockResolvedValue({ ...basePerson, status: 'active' });
    mockPeople.update.mockResolvedValue({ ...basePerson, status: 'inactive' });
  });

  it('When save is called with a different status / Then person.status_changed activity is recorded', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Edit'));

    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => screen.getByText('Save'));

    const statusSelect = screen.getByDisplayValue('Active');
    fireEvent.change(statusSelect, { target: { value: 'inactive' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(mockRecordActivity).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'people.person.status_changed' }),
      ),
    );
  });

  it('When save is called without status change / Then person.updated activity is recorded', async () => {
    mockPeople.update.mockResolvedValue({ ...basePerson });

    renderPage();
    await waitFor(() => screen.getByText('Edit'));

    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => screen.getByText('Save'));

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(mockRecordActivity).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'people.person.updated' }),
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// workLocations rejected — does not blank the page
// ---------------------------------------------------------------------------

describe('Given a person exists and workLocations API fails', () => {
  beforeEach(() => {
    mockPeople.getById.mockResolvedValue({ ...basePerson });
    mockLoc.getAll.mockRejectedValue(new Error('Locations down'));
  });

  it('When workLocations fetch rejects / Then the profile still renders without blanking', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Inline edit work location dropdown populated from API
// ---------------------------------------------------------------------------

describe('Given a person exists with work locations available', () => {
  beforeEach(() => {
    mockPeople.getById.mockResolvedValue({ ...basePerson });
    mockLoc.getAll.mockResolvedValue({
      data: [
        { id: 'wl1', name: 'Main Office', location_type: 'office', is_active: true, org_id: 'o1', tenant_id: 't1', created_at: '', updated_at: '' },
      ],
    });
  });

  it('When editing / Then work location dropdown includes available locations', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Edit'));

    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());
  });
});
