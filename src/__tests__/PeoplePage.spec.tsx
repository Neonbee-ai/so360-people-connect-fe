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
  },
}));


vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import PeoplePage from '../pages/PeoplePage';
import { peopleApi } from '../services/peopleService';

const mockPeopleApi = peopleApi as any;

const renderPage = () =>
  render(<MemoryRouter><PeoplePage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
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
      await waitFor(() => expect(screen.getByText('Failed to load people')).toBeInTheDocument());
    });
  });
});
