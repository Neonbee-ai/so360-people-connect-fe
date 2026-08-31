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
  workLocationsApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../services/mastersService', () => ({
  mastersApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
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
  apiContext: {
    getBaseUrl: vi.fn(() => '/people-api'),
  },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn() },
}));

const { mockRefreshQuota } = vi.hoisted(() => ({ mockRefreshQuota: vi.fn(async () => {}) }));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: mockRefreshQuota }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

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
import { departmentsApi } from '../services/departmentsService';
import { peopleApi } from '../services/peopleService';
import { workLocationsApi } from '../services/workLocationsService';
import { mastersApi } from '../services/mastersService';
import { toast } from '@so360/design-system';

const mockApi = peopleApi as any;
const mockWorkLocationsApi = workLocationsApi as any;
const mockMastersApi = mastersApi as any;

const renderPage = () => render(<MemoryRouter><PeoplePage /></MemoryRouter>);

/**
 * Switch the create form to "Employee Only" so the invite email/role fields —
 * which are mandatory in the default invite mode — do not block submission in
 * tests that are about something else.
 */
const selectNoSystemAccess = () =>
  fireEvent.click(screen.getByText('Employee Only (No System Access)'));


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

beforeEach(() => {
  vi.resetAllMocks();
  (departmentsApi as any).getTree.mockResolvedValue([]);
  mockApi.getOrgRoles.mockResolvedValue({ data: [] });
  // resetAllMocks() above clears the module-level default, so re-establish it:
  // the Edit modal loads labor categories on open.
  mockApi.getLaborCategoryOptions.mockResolvedValue([]);
  mockWorkLocationsApi.getAll.mockResolvedValue({ data: [] });
  mockMastersApi.getAll.mockResolvedValue({ data: [] });
  mockApi.update.mockResolvedValue({ id: 'p1' });
  mockApi.delete.mockResolvedValue({ message: 'Person deactivated successfully', hard_deleted: false });
  mockApi.cancelInvite.mockResolvedValue({ message: 'Invitation cancelled' });
});

describe('Given PeoplePage loads with people', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When page loads / Then "People" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('People Registry')).toBeInTheDocument());
  });

  it('When people are fetched / Then person name is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When people are fetched / Then status badge is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
  });
});

/*
 * BDD specs: the "Import" button on the People Registry navigates to the
 * Import/Export page.
 *
 * Regression: the button previously called navigate('/import-export') which —
 * because the MFE is mounted under the shell at '/people/*' — escaped the
 * module prefix and resolved to the shell root, hitting the shell's
 * "Page Not Found". The correct target is '/people/import-export'.
 */
describe('Given the "Import" button on the People Registry', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When clicked / Then it navigates straight to the Import workflow', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Import'));
    // ?tab=import so the Import button never lands the user on Export.
    expect(mockNavigate).toHaveBeenCalledWith('/people/import-export?tab=import');
  });

  it('When clicked / Then it does NOT navigate to bare /import-export (regression guard: was hitting the shell 404)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Import'));
    expect(mockNavigate).not.toHaveBeenCalledWith('/import-export');
  });
});

describe('Given PeoplePage with no people', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no people exist / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No people/i)).toBeInTheDocument());
  });
});

describe('Given PeoplePage search interaction', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When search box is present / Then it can receive input', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    expect(searchInput).toHaveValue('Alice');
  });
});

describe('Given PeoplePage search debounce', () => {
  // Timer approach: PeoplePage has NO setInterval, so vi.useFakeTimers() is
  // safe. We drive input with fireEvent.change (NOT userEvent) and advance the
  // clock manually so the 300ms debounce can be asserted deterministically.
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When several keystrokes arrive in quick succession / Then the list query fires once after the 300ms pause (input stays instant)', async () => {
    renderPage();
    // Initial load (debouncedSearch === '') happens on mount.
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    const callsAfterMount = mockApi.getAll.mock.calls.length;

    const searchInput = screen.getByPlaceholderText(/Search/i);

    vi.useFakeTimers();
    try {
      // Three rapid keystrokes — the input value updates instantly each time.
      fireEvent.change(searchInput, { target: { value: 'A' } });
      fireEvent.change(searchInput, { target: { value: 'Al' } });
      fireEvent.change(searchInput, { target: { value: 'Ali' } });
      expect(searchInput).toHaveValue('Ali');

      // Before the debounce window elapses, no new fetch is issued.
      vi.advanceTimersByTime(299);
      expect(mockApi.getAll.mock.calls.length).toBe(callsAfterMount);

      // Crossing 300ms triggers exactly one debounced fetch with the final term.
      vi.advanceTimersByTime(1);
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() =>
      expect(mockApi.getAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Ali' }),
      ),
    );
    // Only one additional call beyond mount despite three keystrokes.
    expect(mockApi.getAll.mock.calls.length).toBe(callsAfterMount + 1);
  });

  it('When typing pauses before completing / Then no intermediate term is ever queried', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/Search/i);

    vi.useFakeTimers();
    try {
      fireEvent.change(searchInput, { target: { value: 'Bob' } });
      // Advance only partway — timer still pending, restart on next keystroke.
      vi.advanceTimersByTime(200);
      fireEvent.change(searchInput, { target: { value: 'Bobby' } });
      vi.advanceTimersByTime(300);
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() =>
      expect(mockApi.getAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Bobby' }),
      ),
    );
    // The intermediate 'Bob' term must never have been sent to the backend.
    const searchedTerms = mockApi.getAll.mock.calls.map((c: any[]) => c[0]?.search);
    expect(searchedTerms).not.toContain('Bob');
  });
});

describe('Given PeoplePage create modal', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When Add Person is clicked / Then create modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
  });
});

describe('Given the Work Location field in the create modal', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  const openModal = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
  };

  it('When work locations exist / Then they populate the dropdown', async () => {
    mockWorkLocationsApi.getAll.mockResolvedValue({
      data: [{ id: 'wl-1', name: 'Head Office' }, { id: 'wl-2', name: 'Remote' }],
    });
    await openModal();
    await waitFor(() => expect(screen.getByText('Head Office')).toBeInTheDocument());
    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(screen.getByText('Select Work Location')).toBeInTheDocument();
  });

  it('When no work locations are configured / Then an empty state with a "Manage Work Locations" action is shown, not a bare "None"', async () => {
    mockWorkLocationsApi.getAll.mockResolvedValue({ data: [] });
    await openModal();
    await waitFor(() => expect(screen.getByText(/No work locations configured/i)).toBeInTheDocument());
    expect(screen.queryByText('None')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Manage Work Locations'));
    // Mount-relative: an absolute '/settings/work-locations' escaped this
    // module's /people/* mount point under the shell (see 5e3af34, which
    // changed PeoplePage and its sibling spec but left this one stale).
    expect(mockNavigate).toHaveBeenCalledWith('/people/settings/work-locations');
  });

  it('When the work locations fetch fails / Then an error message is shown instead of silently rendering an empty dropdown', async () => {
    mockWorkLocationsApi.getAll.mockRejectedValue(new Error('network error'));
    await openModal();
    await waitFor(() => expect(screen.getByText(/Couldn't load work locations/i)).toBeInTheDocument());
  });
});

describe('Given the Designation (Job Title) field in the create modal', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  const openModal = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
    // Designation lives behind the Employment Details disclosure now.
    fireEvent.click(screen.getByText('Employment Details'));
  };

  it('When designations exist / Then they populate the dropdown', async () => {
    mockMastersApi.getAll.mockImplementation((type: string) =>
      type === 'designation'
        ? Promise.resolve({ data: [{ id: 'd-1', name: 'Manager' }, { id: 'd-2', name: 'Director' }] })
        : Promise.resolve({ data: [] }),
    );
    await openModal();
    await waitFor(() => expect(screen.getByText('Manager')).toBeInTheDocument());
    expect(screen.getByText('Director')).toBeInTheDocument();
    expect(screen.getByText('Select Designation')).toBeInTheDocument();
  });

  it('When no designations are configured / Then an empty state with a "Create Designation" action is shown, not a bare "None"', async () => {
    mockMastersApi.getAll.mockResolvedValue({ data: [] });
    await openModal();
    await waitFor(() => expect(screen.getByText(/No designations configured/i)).toBeInTheDocument());
    expect(screen.queryByText('None')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Create Designation'));
    expect(mockNavigate).toHaveBeenCalledWith('/people/settings/designations');
  });

  it('When the designations fetch fails / Then an error message is shown instead of silently rendering an empty dropdown', async () => {
    mockMastersApi.getAll.mockImplementation((type: string) =>
      type === 'designation'
        ? Promise.reject(new Error('network error'))
        : Promise.resolve({ data: [] }),
    );
    await openModal();
    await waitFor(() => expect(screen.getByText(/Couldn't load designations/i)).toBeInTheDocument());
  });
});

describe('Given the Employment Type field in the create modal', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  const openModal = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
    // Employment Type lives behind the Employment Details disclosure now.
    fireEvent.click(screen.getByText('Employment Details'));
  };

  it('When employment types exist / Then they populate the dropdown', async () => {
    mockMastersApi.getAll.mockImplementation((type: string) =>
      type === 'employment_type'
        ? Promise.resolve({ data: [{ id: 'et-1', name: 'Full Time', code: 'full_time' }, { id: 'et-2', name: 'Contract', code: 'contract' }] })
        : Promise.resolve({ data: [] }),
    );
    await openModal();
    // "Full Time" also appears in the always-rendered list-page filter select, so
    // assert on the modal-only "Select Employment Type" placeholder plus a count
    // bump for "Full Time" rather than a bare unique-text match.
    await waitFor(() => expect(screen.getByText('Select Employment Type')).toBeInTheDocument());
    expect(screen.getAllByText('Full Time').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Contract').length).toBeGreaterThanOrEqual(1);
  });

  it('When no employment types are configured / Then an empty state with a "Create Employment Type" action is shown, not a bare "None"', async () => {
    mockMastersApi.getAll.mockResolvedValue({ data: [] });
    await openModal();
    await waitFor(() => expect(screen.getByText(/No employment types configured/i)).toBeInTheDocument());
    expect(screen.queryByText('None')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Create Employment Type'));
    expect(mockNavigate).toHaveBeenCalledWith('/people/settings/employment-types');
  });

  it('When the employment types fetch fails / Then an error message is shown instead of silently rendering an empty dropdown', async () => {
    mockMastersApi.getAll.mockImplementation((type: string) =>
      type === 'employment_type'
        ? Promise.reject(new Error('network error'))
        : Promise.resolve({ data: [] }),
    );
    await openModal();
    await waitFor(() => expect(screen.getByText(/Couldn't load employment types/i)).toBeInTheDocument());
  });
});

describe('Given the Department field in the create modal', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
    (departmentsApi as any).getTree.mockResolvedValue([
      { id: 'dep-eng', name: 'Engineering', code: 'ENG', children: [] },
      { id: 'dep-sales', name: 'Sales', code: 'SALES', children: [] },
    ]);
  });

  const openModal = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
  };

  it('When the modal opens / Then Department is a searchable dropdown, not a free-text input', async () => {
    await openModal();
    // The old free-text input used placeholder "Engineering" — it must be gone.
    expect(screen.queryByPlaceholderText('Engineering')).not.toBeInTheDocument();
    // The DepartmentSelector dropdown placeholder is present instead.
    expect(screen.getByText('Select department...')).toBeInTheDocument();
  });

  it('When a department is searched and selected / Then the create payload stores department_id (relational ref, no free text)', async () => {
    await openModal();

    const nameInput = screen.getByPlaceholderText('John Doe');
    fireEvent.change(nameInput, { target: { value: 'New Hire' } });
    // Wait for React 18 batched state to commit before proceeding
    await waitFor(() => expect(nameInput).toHaveValue('New Hire'));

    // Open the dropdown and load active departments.
    fireEvent.click(screen.getByText('Select department...'));
    await waitFor(() => expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0));

    // Search narrows the list.
    const searchBox = screen.getByPlaceholderText('Select department...');
    fireEvent.change(searchBox, { target: { value: 'eng' } });
    await waitFor(() => expect(screen.queryByText('Sales')).not.toBeInTheDocument());

    // Click the dropdown option (last 'Engineering' in DOM is the dropdown span)
    const engItems = screen.getAllByText('Engineering');
    fireEvent.click(engItems[engItems.length - 1]);
    // Wait for dropdown to close — ensures department_id state is committed in same React batch
    await waitFor(() => expect(screen.queryByPlaceholderText('Select department...')).not.toBeInTheDocument());

    selectNoSystemAccess();

    // Submit via form element to avoid jsdom click→submit edge cases
    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
    const payload = mockApi.create.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({ department_id: 'dep-eng' }));
    expect(payload).not.toHaveProperty('department');
  });

  it('When no department is selected / Then department_id is omitted (not an empty string)', async () => {
    await openModal();
    const nameInput = screen.getByPlaceholderText('John Doe');
    fireEvent.change(nameInput, { target: { value: 'No Dept' } });
    // Wait for React 18 batched state to commit before submitting
    await waitFor(() => expect(nameInput).toHaveValue('No Dept'));

    selectNoSystemAccess();

    // Submit via form element to avoid jsdom click→submit edge cases
    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
    expect(mockApi.create.mock.calls[0][0].department_id).toBeUndefined();
  });
});

describe('Given the "Invite as New User" flow on create', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
    mockApi.getOrgRoles.mockResolvedValue({ data: [{ id: 'role-1', name: 'Member' }] });
    mockApi.create.mockResolvedValue({ id: 'new-p' });
  });

  const openModalAndFillInvite = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());

    const nameInput = screen.getByPlaceholderText('John Doe');
    fireEvent.change(nameInput, { target: { value: 'New Hire' } });
    await waitFor(() => expect(nameInput).toHaveValue('New Hire'));

    // Invite mode is the default. The invitation always goes to the Identity email —
    // the field inside "Invite as New User" is a read-only mirror of it.
    fireEvent.change(screen.getByPlaceholderText('john@company.com'), { target: { value: 'hire@test.com' } });
    await waitFor(() => expect(screen.getByPlaceholderText('Email for invitation')).toHaveValue('hire@test.com'));

    const roleSelect = screen.getAllByRole('combobox').find(s => within(s).queryByText('Select role...'))!;
    fireEvent.change(roleSelect, { target: { value: 'role-1' } });

    return nameInput.closest('form')!;
  };

  it('When a new user is invited / Then inviteUser is called and the copyable link is shown', async () => {
    mockApi.inviteUser.mockResolvedValue({ invite_link: 'https://sso.neonbee.app/reset-password-confirm#token=xyz', invite_status: 'link_generated', user_id: 'u1', email_sent: true });

    const form = await openModalAndFillInvite();
    fireEvent.submit(form);

    await waitFor(() => expect(mockApi.inviteUser).toHaveBeenCalledWith('new-p', 'hire@test.com', 'role-1', true));
    // The copyable invite link surfaces for manual sharing.
    await waitFor(() => expect(screen.getByDisplayValue('https://sso.neonbee.app/reset-password-confirm#token=xyz')).toBeInTheDocument());
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('When the invitee already has an account / Then no link modal is shown', async () => {
    mockApi.inviteUser.mockResolvedValue({ invite_link: null, invite_status: 'existing_user', user_id: 'u2', email_sent: false });

    const form = await openModalAndFillInvite();
    fireEvent.submit(form);

    await waitFor(() => expect(mockApi.inviteUser).toHaveBeenCalled());
    expect(screen.queryByText('Copy link')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Employee management: Edit / Deactivate / Archive / Delete / Resend / Cancel
// =============================================================================

const openRowActionsMenu = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Employee actions'));
};

describe('Given the row Actions (⋮) menu', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When opened / Then shows Edit and Delete Employee for an active employee', async () => {
    await openRowActionsMenu();
    expect(screen.getByText('Edit Employee')).toBeInTheDocument();
    expect(screen.getByText('Delete Employee')).toBeInTheDocument();
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('When a pending person is shown / Then Resend and Cancel Invitation actions appear', async () => {
    mockApi.getAll.mockResolvedValue({
      data: [{ ...mockPerson, access_status: 'pending', invitation_status: 'pending' }],
      total: 1,
    });
    await openRowActionsMenu();
    expect(screen.getByText('Resend Invitation')).toBeInTheDocument();
    expect(screen.getByText('Cancel Invitation')).toBeInTheDocument();
  });
});

describe('Given "Edit Employee" is clicked', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When opened / Then the Edit modal is pre-filled and saving calls peopleApi.update', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Edit Employee'));

    await waitFor(() => expect(screen.getByText('Edit Alice Smith')).toBeInTheDocument());
    const nameInput = screen.getByDisplayValue('Alice Smith');
    fireEvent.change(nameInput, { target: { value: 'Alice Updated' } });

    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(mockApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({ full_name: 'Alice Updated' })),
    );
  });
});

describe('Given the Edit modal\'s timesheet costing defaults', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  const openEditModal = async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Edit Employee'));
    await waitFor(() => expect(screen.getByText('Edit Alice Smith')).toBeInTheDocument());
  };

  it('When the modal opens / Then the labor category options are loaded', async () => {
    await openEditModal();
    await waitFor(() => expect(mockApi.getLaborCategoryOptions).toHaveBeenCalled());
  });

  // Unconfigured costing is what blocks an employee from logging time, so the
  // section must not be a place that configuration quietly hides.
  it('Given nothing is configured / When the modal opens / Then the section auto-expands and reports what is missing', async () => {
    await openEditModal();
    expect(await screen.findByLabelText('Default Labor Category')).toBeInTheDocument();
    expect(screen.getByText('2 missing')).toBeInTheDocument();
  });

  it('Given both fields are configured / When the modal opens / Then no missing badge is shown', async () => {
    mockApi.getAll.mockResolvedValue({
      data: [{ ...mockPerson, default_labor_category_id: 'cat-1', billing_type: 'billable' }],
      total: 1,
    });
    await openEditModal();
    expect(screen.queryByText(/missing/)).not.toBeInTheDocument();
  });

  it('When categories are returned / Then they populate the selector', async () => {
    mockApi.getLaborCategoryOptions.mockResolvedValue([
      { id: 'cat-1', code: 'SWE', name: 'Software Engineer', base_hourly_rate: 90, overtime_multiplier: 1.5, rate_configured: true },
    ]);
    await openEditModal();
    expect(await screen.findByText('Software Engineer')).toBeInTheDocument();
  });

  // base_hourly_rate of 0 is legal but means unconfigured — picking such a
  // category will not make a rateless employee costable, so say so.
  it('Given a category has no rate / When listed / Then it is flagged rather than shown as usable', async () => {
    mockApi.getLaborCategoryOptions.mockResolvedValue([
      { id: 'cat-2', code: 'GEN', name: 'General', base_hourly_rate: 0, overtime_multiplier: 1.5, rate_configured: false },
    ]);
    await openEditModal();
    expect(await screen.findByText('General (no rate)')).toBeInTheDocument();
  });

  it('Given the options call fails / When the modal opens / Then the form still renders', async () => {
    mockApi.getLaborCategoryOptions.mockRejectedValue(new Error('service down'));
    await openEditModal();
    expect(await screen.findByLabelText('Default Labor Category')).toBeInTheDocument();
  });

  it('When the fields are set and saved / Then both are sent in the update payload', async () => {
    mockApi.getLaborCategoryOptions.mockResolvedValue([
      { id: 'cat-1', code: 'SWE', name: 'Software Engineer', base_hourly_rate: 90, overtime_multiplier: 1.5, rate_configured: true },
    ]);
    await openEditModal();

    fireEvent.change(await screen.findByLabelText('Default Labor Category'), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByLabelText('Billing Type'), { target: { value: 'billable' } });
    fireEvent.submit(screen.getByDisplayValue('Alice Smith').closest('form')!);

    await waitFor(() =>
      expect(mockApi.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ default_labor_category_id: 'cat-1', billing_type: 'billable' }),
      ),
    );
  });

  // An empty <select> value is '', which would trip the backend @IsUUID/@IsEnum
  // validators. "Cleared" must travel as null.
  it('When a field is cleared / Then null is sent rather than an empty string', async () => {
    mockApi.getAll.mockResolvedValue({
      data: [{ ...mockPerson, default_labor_category_id: 'cat-1', billing_type: 'billable' }],
      total: 1,
    });
    await openEditModal();

    fireEvent.change(await screen.findByLabelText('Default Labor Category'), { target: { value: '' } });
    fireEvent.submit(screen.getByDisplayValue('Alice Smith').closest('form')!);

    await waitFor(() => expect(mockApi.update).toHaveBeenCalled());
    const payload = mockApi.update.mock.calls[0][1];
    expect(payload.default_labor_category_id).toBeNull();
    expect(payload.default_labor_category_id).not.toBe('');
  });

  // Cost centres belong to Accounting and are inherited via the department.
  // An editable control here would fork the org's chart of cost centres.
  it('When the section is shown / Then the cost centre is read-only, not an input', async () => {
    await openEditModal();
    await screen.findByLabelText('Default Labor Category');
    expect(screen.getByText('Set on the department, not the employee.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cost Center')).not.toBeInTheDocument();
  });
});

describe('Given "Deactivate" is clicked from the Actions menu', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When confirmed / Then peopleApi.update is called with status inactive', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Deactivate'));

    await waitFor(() => expect(screen.getByText('Deactivate Employee')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith('p1', { status: 'inactive' }));
  });
});

describe('Given "Archive" is clicked from the Actions menu', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When confirmed / Then peopleApi.update is called with status archived', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Archive'));

    await waitFor(() => expect(screen.getByText('Archive Employee')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith('p1', { status: 'archived' }));
  });
});

describe('Given "Delete Employee" is clicked from the Actions menu', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When confirmed / Then peopleApi.delete is called and the resulting message is toasted', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Person deactivated successfully', hard_deleted: false });
    const toastInfoSpy = vi.spyOn(toast, 'info');
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Delete Employee'));

    await waitFor(() => expect(screen.getByText('Delete Employee', { selector: 'h2' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Employee' }));

    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(toastInfoSpy).toHaveBeenCalledWith('Person deactivated successfully'));
  });

  it('When a delete really removes the employee / Then the success message is toasted', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Alice Smith was permanently deleted', hard_deleted: true, blockers: [] });
    const toastSuccessSpy = vi.spyOn(toast, 'success');
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Delete Employee'));
    await waitFor(() => expect(screen.getByText('Delete Employee', { selector: 'h2' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Employee' }));

    await waitFor(() => expect(toastSuccessSpy).toHaveBeenCalledWith('Alice Smith was permanently deleted'));
  });

  it('When the delete is blocked by linked records / Then the blocking tables are surfaced to the admin', async () => {
    mockApi.delete.mockResolvedValue({
      message: 'Alice Smith has linked business records (time_entries) and cannot be permanently deleted. They have been deactivated instead and can no longer sign in.',
      hard_deleted: false,
      blockers: ['time_entries'],
    });
    const toastInfoSpy = vi.spyOn(toast, 'info');
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Delete Employee'));
    await waitFor(() => expect(screen.getByText('Delete Employee', { selector: 'h2' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Employee' }));

    await waitFor(() => expect(toastInfoSpy).toHaveBeenCalledWith(expect.stringContaining('time_entries')));
  });
});

/*
 * The three lifecycle actions are distinct outcomes, and the confirmation is
 * the only place the admin learns which one they are about to trigger. These
 * specs pin the promises that copy makes.
 */
describe('Given the lifecycle confirmation dialogs', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When Deactivate is chosen / Then the dialog warns that platform access is lost', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Deactivate'));
    await waitFor(() => expect(screen.getByText('Deactivate Employee')).toBeInTheDocument());
    expect(screen.getByText(/Deactivate Alice Smith\? They will immediately lose access to the platform/i)).toBeInTheDocument();
  });

  it('When Archive is chosen / Then the dialog promises history is preserved and access is revoked', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Archive'));
    await waitFor(() => expect(screen.getByText('Archive Employee')).toBeInTheDocument());
    expect(screen.getByText(/historical records are preserved/i)).toBeInTheDocument();
    expect(screen.getByText(/lose platform access/i)).toBeInTheDocument();
  });

  it('When Delete is chosen / Then the dialog names the employee and states the action is destructive and irreversible', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Delete Employee'));
    await waitFor(() => expect(screen.getByText('Delete Employee', { selector: 'h2' })).toBeInTheDocument());
    expect(screen.getByText(/Permanently delete Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('When Delete is dismissed / Then nothing is deleted', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Delete Employee'));
    await waitFor(() => expect(screen.getByText('Delete Employee', { selector: 'h2' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Delete Employee', { selector: 'h2' })).not.toBeInTheDocument());
    expect(mockApi.delete).not.toHaveBeenCalled();
  });
});

/*
 * Regression: the People Registry quota bar ("0 / Unlimited") never updated
 * after adding/removing an employee because the page loaded quotaData once
 * and never called useQuota's refresh() on mutation. Every mutation that can
 * change the employee count (create, edit, deactivate, archive, delete) must
 * bust the 60s quota cache immediately.
 */
describe('Given PeoplePage mutates an employee', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When a person is created / Then the quota counter is refreshed', async () => {
    mockApi.create.mockResolvedValue({ id: 'new-p' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
    const nameInput = screen.getByPlaceholderText('John Doe');
    fireEvent.change(nameInput, { target: { value: 'Bob Jones' } });
    selectNoSystemAccess();
    const form = nameInput.closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
    await waitFor(() => expect(mockRefreshQuota).toHaveBeenCalled());
  });

  it('When an employee is edited / Then the quota counter is refreshed', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Edit Employee'));
    await waitFor(() => expect(screen.getByText('Edit Alice Smith')).toBeInTheDocument());
    const form = screen.getByDisplayValue('Alice Smith').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(mockApi.update).toHaveBeenCalled());
    await waitFor(() => expect(mockRefreshQuota).toHaveBeenCalled());
  });

  it('When an employee is deactivated / Then the quota counter is refreshed', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Deactivate'));
    await waitFor(() => expect(screen.getByText('Deactivate Employee')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith('p1', { status: 'inactive' }));
    await waitFor(() => expect(mockRefreshQuota).toHaveBeenCalled());
  });

  it('When an employee is archived / Then the quota counter is refreshed', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Archive'));
    await waitFor(() => expect(screen.getByText('Archive Employee')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith('p1', { status: 'archived' }));
    await waitFor(() => expect(mockRefreshQuota).toHaveBeenCalled());
  });

  it('When an employee is deleted / Then the quota counter is refreshed', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Person deleted', hard_deleted: true });
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Delete Employee'));
    await waitFor(() => expect(screen.getByText('Delete Employee', { selector: 'h2' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Employee' }));
    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(mockRefreshQuota).toHaveBeenCalled());
  });
});

describe('Given "Cancel Invitation" is clicked for a pending person', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({
      data: [{ ...mockPerson, access_status: 'pending', invitation_status: 'pending' }],
      total: 1,
    });
  });

  it('When confirmed / Then peopleApi.cancelInvite is called', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Cancel Invitation'));

    await waitFor(() => expect(screen.getByText('Cancel Invitation', { selector: 'h2' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Invitation' }));

    await waitFor(() => expect(mockApi.cancelInvite).toHaveBeenCalledWith('p1'));
  });
});

describe('Given "Resend Invitation" is clicked for a pending person', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({
      data: [{ ...mockPerson, access_status: 'pending', invitation_status: 'pending' }],
      total: 1,
    });
    // resolveInviteRoleId matches the person's system_role by name, falling back
    // to a role literally named "Employee" — it deliberately no longer grabs
    // roles[0], which handed out whichever role the API returned first.
    mockApi.getOrgRoles.mockResolvedValue({ data: [{ id: 'role-1', name: 'Employee' }] });
  });

  it('When clicked / Then peopleApi.inviteUser is called again for that person', async () => {
    await openRowActionsMenu();
    fireEvent.click(screen.getByText('Resend Invitation'));

    await waitFor(() => expect(mockApi.inviteUser).toHaveBeenCalledWith('p1', 'alice@test.com', 'role-1', true));
  });
});
