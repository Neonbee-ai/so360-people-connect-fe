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

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    export: vi.fn(),
    getOrgRoles: vi.fn().mockResolvedValue({ data: [] }),
    inviteUser: vi.fn().mockResolvedValue({ invite_link: null, invite_status: 'existing_user', user_id: 'u1', email_sent: false }),
  },
  apiContext: {
    getBaseUrl: vi.fn(() => '/people-api'),
  },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
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

const mockApi = peopleApi as any;
const mockWorkLocationsApi = workLocationsApi as any;

const renderPage = () => render(<MemoryRouter><PeoplePage /></MemoryRouter>);

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
  mockWorkLocationsApi.getAll.mockResolvedValue({ data: [] });
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

  it('When clicked / Then it navigates to /people/import-export', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Import'));
    expect(mockNavigate).toHaveBeenCalledWith('/people/import-export');
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

    // Invite mode is the default; fill the invitation email + role.
    const inviteEmail = screen.getByPlaceholderText('Email for invitation');
    fireEvent.change(inviteEmail, { target: { value: 'hire@test.com' } });

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
