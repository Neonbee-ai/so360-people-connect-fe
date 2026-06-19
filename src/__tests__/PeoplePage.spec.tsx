import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../hooks/useShellContext', () => ({
  usePeopleContext: () => ({ orgId: 'org-1', tenantId: 'tenant-1', userId: 'user-1', accessToken: 'tok' }),
}));

vi.mock('../services/apiClient', () => ({
  apiContext: { getAccessToken: () => 'tok', getOrgId: () => 'org-1', getTenantId: () => 'tenant-1' },
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    export: vi.fn(),
    getOrgRoles: vi.fn().mockResolvedValue({ data: [] }),
    inviteUser: vi.fn(),
  },
}));

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn().mockResolvedValue([]) },
}));


let mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ ...mockShellFlags, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

// Symbol the org formatter renders. Defaults to '$' (USD); BDD currency specs
// flip it to prove rates are formatted via the org's business-settings currency
// rather than a hardcoded '$'.
let mockCurrencySymbol = '$';
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `${mockCurrencySymbol}${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

import PeoplePage from '../pages/PeoplePage';
import { peopleApi } from '../services/peopleService';
import { workLocationsApi } from '../services/workLocationsService';
import { departmentsApi } from '../services/departmentsService';

const mockPeopleApi = peopleApi as any;
const mockWorkLocationsApi = workLocationsApi as any;

const renderPage = () =>
  render(<MemoryRouter><PeoplePage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockWorkLocationsApi.getAll.mockResolvedValue({ data: [] });
  (departmentsApi as any).getTree.mockResolvedValue([]);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
});

describe('PeoplePage', () => {
  describe('Given the API returns a list of people', () => {
    beforeEach(() => {
      mockPeopleApi.getAll.mockResolvedValue({
        data: [
          { id: '1', full_name: 'Alice Johnson', email: 'alice@test.com', type: 'employee', status: 'active', cost_rate: 50, cost_rate_unit: 'hour', job_title: 'Engineer', department: 'Engineering', people_roles: [] },
          { id: '2', full_name: 'Bob Smith', email: 'bob@test.com', type: 'contractor', status: 'inactive', cost_rate: 75, cost_rate_unit: 'hour', job_title: 'Designer', department: 'Design', people_roles: [] },
        ],
      });
    });

    it('When the page loads / Then it renders the people list with names', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });

    it('When the page loads / Then it displays the page header', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('People Registry')).toBeInTheDocument());
    });

    it('When a search term is entered / Then the API is called with the search parameter', async () => {
      renderPage();
      await waitFor(() => expect(mockPeopleApi.getAll).toHaveBeenCalled());
      const searchInput = screen.getByPlaceholderText('Search by name, email, or title...');
      fireEvent.change(searchInput, { target: { value: 'Alice' } });
      await waitFor(() => expect(mockPeopleApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ search: 'Alice' })));
    });

    it('When a status filter is selected / Then the API is called with status', async () => {
      renderPage();
      await waitFor(() => expect(mockPeopleApi.getAll).toHaveBeenCalled());
      const statusSelect = screen.getByDisplayValue('All Statuses');
      fireEvent.change(statusSelect, { target: { value: 'active' } });
      await waitFor(() => expect(mockPeopleApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' })));
    });

    it('When the Add Person button is clicked / Then the create modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Person'));
      await waitFor(() => expect(screen.getByText('Identity')).toBeInTheDocument());
    });

    it('When a person row is clicked / Then it navigates to the person detail using the shell-scoped path', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Alice Johnson'));
      // The shell mounts People Connect at /people/*; the People Registry list is at
      // /people/people, so the detail page must be at /people/people/:id — not /people/:id.
      expect(mockNavigate).toHaveBeenCalledWith('/people/people/1');
    });
  });

  describe('Given the org-wide currency is not USD', () => {
    beforeEach(() => {
      mockCurrencySymbol = 'AED ';
      mockPeopleApi.getAll.mockResolvedValue({
        data: [
          { id: '1', full_name: 'Alice Johnson', email: 'alice@test.com', type: 'employee', status: 'active', cost_rate: 50, cost_rate_unit: 'hour', billing_rate: 80, job_title: 'Engineer', department: 'Engineering', people_roles: [] },
        ],
      });
    });
    afterEach(() => { mockCurrencySymbol = '$'; });

    it('When a person card shows cost and billing rates / Then they render in the org currency, not a hardcoded $', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('AED 50/hour')).toBeInTheDocument());
      expect(screen.getByText('Bill: AED 80/hour')).toBeInTheDocument();
      expect(screen.queryByText('$50/hour')).not.toBeInTheDocument();
    });
  });

  describe('Given the API returns an empty list', () => {
    beforeEach(() => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No people found')).toBeInTheDocument());
    });

    it('When the page loads / Then the empty state has an action button', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Add First Person')).toBeInTheDocument());
    });
  });

  describe('Given the API call fails', () => {
    beforeEach(() => {
      mockPeopleApi.getAll.mockImplementation(async () => { throw new Error('Network error'); });
    });

    it('When the page loads / Then it shows an error toast', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('People Registry')).toBeInTheDocument());
      expect(screen.getByText('Failed to load people')).toBeInTheDocument();
    });
  });
});

describe('PeoplePage — effectiveFlagsLoaded gate', () => {
  it('When effectiveFlagsLoaded is false / Then Add Person / Import / Export buttons are absent', async () => {
    mockShellFlags = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
    mockPeopleApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No people found')).toBeInTheDocument());
    expect(screen.queryByText('Add Person')).not.toBeInTheDocument();
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
    expect(screen.queryByText('Export')).not.toBeInTheDocument();
  });

  it('When effectiveFlagsLoaded is true / Then Add Person / Import / Export buttons are present', async () => {
    mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
    mockPeopleApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No people found')).toBeInTheDocument());
    expect(screen.getByText('Add Person')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});

// =============================================================================
// People Registry ↔ Team Management unification — system access columns
// =============================================================================

// Build a registry person with the system-access fields under test. Defaults
// are deliberately minimal so legacy-payload specs can omit the new fields.
const accessPerson = (over: Record<string, any> = {}) => ({
  id: 'p1',
  full_name: 'Jane Doe',
  email: 'jane@test.com',
  type: 'employee',
  status: 'active',
  cost_rate: 50,
  cost_rate_unit: 'hour',
  job_title: 'Engineer',
  department: 'Engineering',
  people_roles: [],
  ...over,
});

// Scope assertions to a single person's card so duplicated labels (Role:/Invite:)
// across rows never cross-match.
const rowFor = (name: string) =>
  screen.getByText(name).closest('div.bg-slate-900') as HTMLElement;

describe('PeoplePage — System access columns', () => {
  describe('Access Status badge', () => {
    it('Given access_status=active / Then renders "Has Access"', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'active' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).getByText('Has Access')).toBeInTheDocument();
    });

    it('Given access_status=pending / Then renders "Invitation Pending"', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'pending' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).getByText('Invitation Pending')).toBeInTheDocument();
    });

    it('Given access_status=no_access / Then renders "No Access"', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'no_access' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).getByText('No Access')).toBeInTheDocument();
    });

    it('Given login_status=blocked / Then "Blocked" overrides access_status', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'active', login_status: 'blocked' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      const row = rowFor('Jane Doe');
      expect(within(row).getByText('Blocked')).toBeInTheDocument();
      expect(within(row).queryByText('Has Access')).not.toBeInTheDocument();
    });

    it('Given no access_status (legacy payload) / Then defaults to "No Access"', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson()] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).getByText('No Access')).toBeInTheDocument();
    });
  });

  describe('System Role', () => {
    it('Given system_role is set / Then it renders the role value', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'active', system_role: 'Admin' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).getByText('Role: Admin')).toBeInTheDocument();
    });

    it('Given system_role is absent / Then it renders the "—" fallback', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'no_access' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).getByText('Role: —')).toBeInTheDocument();
    });
  });

  describe('Invitation Status', () => {
    it('Given invitation_status=accepted / Then renders "Accepted"', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'active', invitation_status: 'accepted' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).getByText('Invite: Accepted')).toBeInTheDocument();
    });

    it('Given invitation_status=expired / Then renders "Expired"', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'no_access', invitation_status: 'expired' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).getByText('Invite: Expired')).toBeInTheDocument();
    });

    it('Given invitation_status is null / Then renders the "—" fallback', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'no_access', invitation_status: null })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).getByText('Invite: —')).toBeInTheDocument();
    });
  });

  describe('Invite action', () => {
    it('Given a no_access row / Then the Invite button is visible and enabled', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'no_access' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      const btn = within(rowFor('Jane Doe')).getByRole('button', { name: /Invite/ });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    it('Given a no_access row with email / When Invite is clicked / Then inviteUser is called and the row does not navigate', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ id: 'p1', access_status: 'no_access', email: 'jane@x.com' })] });
      mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [{ id: 'role-1', name: 'Member' }] });
      mockPeopleApi.inviteUser.mockResolvedValue({ invite_status: 'link_generated', invite_link: 'https://invite/abc', email_sent: true, user_id: null });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      fireEvent.click(within(rowFor('Jane Doe')).getByRole('button', { name: /Invite/ }));
      await waitFor(() => expect(mockPeopleApi.inviteUser).toHaveBeenCalledWith('p1', 'jane@x.com', 'role-1', true));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('Given a pending row / Then the button shows "Invited" and is disabled', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'pending' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      const btn = within(rowFor('Jane Doe')).getByRole('button', { name: /Invited/ });
      expect(btn).toBeDisabled();
    });

    it('Given an active (has-access) row / Then no Invite button is shown', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson({ access_status: 'active' })] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      expect(within(rowFor('Jane Doe')).queryByRole('button', { name: /Invite/ })).not.toBeInTheDocument();
    });
  });

  describe('Backward compatibility', () => {
    it('Given a fully legacy payload (no new fields) / Then the row still renders without crashing', async () => {
      mockPeopleApi.getAll.mockResolvedValue({ data: [accessPerson()] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
      const row = rowFor('Jane Doe');
      expect(within(row).getByText('No Access')).toBeInTheDocument();
      expect(within(row).getByText('Role: —')).toBeInTheDocument();
      expect(within(row).getByText('Invite: —')).toBeInTheDocument();
    });
  });
});
