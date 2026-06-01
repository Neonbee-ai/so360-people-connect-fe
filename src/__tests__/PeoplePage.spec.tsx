import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  },
}));

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
}));


let mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ ...mockShellFlags, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

import PeoplePage from '../pages/PeoplePage';
import { peopleApi } from '../services/peopleService';
import { workLocationsApi } from '../services/workLocationsService';

const mockPeopleApi = peopleApi as any;
const mockWorkLocationsApi = workLocationsApi as any;

const renderPage = () =>
  render(<MemoryRouter><PeoplePage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockWorkLocationsApi.getAll.mockResolvedValue({ data: [] });
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

    it('When a person row is clicked / Then it navigates to the person detail', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Alice Johnson'));
      expect(mockNavigate).toHaveBeenCalledWith('/people/1');
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
      mockPeopleApi.getAll.mockRejectedValue(new Error('Network error'));
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
