import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/peopleService', () => ({
  peopleApi: { getById: vi.fn(), update: vi.fn(), addRole: vi.fn(), removeRole: vi.fn(), getEmploymentHistory: vi.fn(), getRateHistory: vi.fn(), linkUser: vi.fn(), inviteUser: vi.fn() },
  allocationsApi: { getAll: vi.fn() },
}));

vi.mock('../services/timesheetApi', () => ({
  timesheetApi: { getEntries: vi.fn() },
}));

vi.mock('../services/goalsService', () => ({
  goalsApi: { getAll: vi.fn() },
  Goal: {},
}));

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn().mockResolvedValue([]) },
  WorkLocation: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

import PersonDetailPage from '../pages/PersonDetailPage';
import { peopleApi, allocationsApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import { goalsApi } from '../services/goalsService';
import { workLocationsApi } from '../services/workLocationsService';

const mockPeople = peopleApi as any;
const mockAlloc = allocationsApi as any;
const mockTime = timesheetApi as any;
const mockGoals = goalsApi as any;

const renderPage = (id = 'p1') => render(
  <MemoryRouter initialEntries={[`/people/${id}`]}>
    <Routes>
      <Route path="/people/:id" element={<PersonDetailPage />} />
      <Route path="/people" element={<div>People List</div>} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  vi.resetAllMocks();
  mockNavigate.mockReset();
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('PersonDetailPage', () => {
  describe('Given a person exists', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue({
        id: 'p1', full_name: 'Alice Smith', type: 'employee', status: 'active',
        email: 'alice@test.com', phone: '+1234567890', job_title: 'Developer',
        department: 'Engineering', cost_rate: 50, cost_rate_unit: 'hour', currency: 'USD',
        billing_rate: 75, available_hours_per_day: 8, start_date: '2024-01-01',
        people_roles: [
          { id: 'r1', role_name: 'Frontend Dev', skill_category: 'Engineering', proficiency: 'expert', is_primary: true },
        ],
        user_id: null,
      });
      mockAlloc.getAll.mockResolvedValue({
        data: [
          { id: 'a1', entity_name: 'Website', entity_id: 'pr1', entity_type: 'project', start_date: '2025-01-01', end_date: '2025-06-30', allocation_percentage: 50, status: 'active' },
        ],
      });
      mockTime.getEntries.mockResolvedValue({
        data: [
          { id: 'te1', entity_name: 'Website', entity_type: 'project', entry_date: '2025-06-01', hours: 8, calculated_cost: 400, status: 'approved', description: 'Dev work' },
        ],
      });
    });

    it('When the page loads / Then it shows the person details', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
      expect(screen.getByText('Developer')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows roles', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Frontend Dev')).toBeInTheDocument());
      expect(screen.getByText('Primary')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows stats', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('$50/hour')).toBeInTheDocument());
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('When the allocations tab is clicked / Then it shows allocations', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Allocations'));
      await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    });

    it('When the time tab is clicked / Then it shows time entries', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Time Entries'));
      await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    });

    it('When Edit is clicked / Then edit fields appear', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => expect(screen.getAllByText('Cost Rate').length).toBeGreaterThan(1));
    });

    it('When Add Role is clicked / Then the add role modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Add Role')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Role'));
      await waitFor(() => expect(screen.getByText('Add Role / Skill')).toBeInTheDocument());
    });

    it('When Link User is shown for unlinked person / Then it is visible', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Link User')).toBeInTheDocument());
    });

    it('When the Back arrow button is clicked / Then it navigates to the shell-scoped list path', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      // The shell mounts People Connect at /people/*; the list is at /people/people
      // not /people — otherwise the router strips the MFE prefix and shows the dashboard.
      fireEvent.click(screen.getByText('Back to People'));
      expect(mockNavigate).toHaveBeenCalledWith('/people/people');
    });
  });

  describe('Given a person exists and the user interacts with tabs', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue({
        id: 'p1', full_name: 'Alice Smith', type: 'employee', status: 'active',
        email: 'alice@test.com', phone: '+1234567890', job_title: 'Developer',
        department: 'Engineering', cost_rate: 50, cost_rate_unit: 'hour', currency: 'USD',
        billing_rate: 75, available_hours_per_day: 8, start_date: '2024-01-01',
        people_roles: [
          { id: 'r1', role_name: 'Frontend Dev', skill_category: 'Engineering', proficiency: 'expert', is_primary: true },
        ],
        user_id: null,
      });
      mockAlloc.getAll.mockResolvedValue({
        data: [
          { id: 'a1', entity_name: 'Website', entity_id: 'pr1', entity_type: 'project', start_date: '2025-01-01', end_date: '2025-06-30', allocation_percentage: 50, status: 'active' },
        ],
      });
      mockTime.getEntries.mockResolvedValue({
        data: [
          { id: 'te1', entity_name: 'Website', entity_type: 'project', entry_date: '2025-06-01', hours: 8, calculated_cost: 400, status: 'approved', description: 'Dev work' },
        ],
      });
    });

    it('When Employment History tab is clicked / Then it loads employment history', async () => {
      mockPeople.getEmploymentHistory.mockResolvedValue([
        { id: 'eh1', event_type: 'promotion', effective_date: '2025-01-15', notes: 'Promoted to senior', new_job_title: 'Sr Developer', created_at: '2025-01-15' },
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Employment History'));
      await waitFor(() => expect(mockPeople.getEmploymentHistory).toHaveBeenCalledWith('p1'));
      await waitFor(() => expect(screen.getByText(/Promoted to senior/)).toBeInTheDocument());
    });

    it('When Rate History tab is clicked / Then it loads rate history', async () => {
      mockPeople.getRateHistory.mockResolvedValue([
        { id: 'rh1', new_cost_rate: 60, new_billing_rate: 90, effective_date: '2025-03-01', reason: 'Annual review' },
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Rate History'));
      await waitFor(() => expect(mockPeople.getRateHistory).toHaveBeenCalledWith('p1'));
      await waitFor(() => expect(screen.getByText(/Annual review/)).toBeInTheDocument());
    });

    it('When Goals tab is clicked / Then it loads goals', async () => {
      mockGoals.getAll.mockResolvedValue({
        data: [
          { id: 'g1', title: 'Learn React', status: 'in_progress', goal_type: 'individual', description: 'Master React 19', target_date: '2025-12-31', progress_percentage: 60 },
        ],
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Goals'));
      await waitFor(() => expect(mockGoals.getAll).toHaveBeenCalledWith({ person_id: 'p1' }));
      await waitFor(() => expect(screen.getByText('Learn React')).toBeInTheDocument());
      expect(screen.getByText('60% complete')).toBeInTheDocument();
    });

    it('When Save is clicked in edit mode / Then it calls the update API', async () => {
      mockPeople.update.mockResolvedValue({ id: 'p1', full_name: 'Alice Smith', cost_rate: 60 });
      renderPage();
      await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => expect(screen.getByText('Save')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(mockPeople.update).toHaveBeenCalledWith('p1', expect.any(Object)));
    });

    it('When Cancel is clicked in edit mode / Then editing is stopped', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => expect(screen.getByText('Cancel')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Cancel'));
      await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
    });

    it('When a role is removed / Then removeRole is called', async () => {
      mockPeople.removeRole.mockResolvedValue({ message: 'ok' });
      renderPage();
      await waitFor(() => expect(screen.getByText('Frontend Dev')).toBeInTheDocument());
      const trashButton = screen.getByTestId('icon-Trash2').closest('button');
      if (trashButton) fireEvent.click(trashButton);
      await waitFor(() => expect(mockPeople.removeRole).toHaveBeenCalledWith('p1', 'r1'));
    });

    it('When Employment History is empty / Then empty state is shown', async () => {
      mockPeople.getEmploymentHistory.mockResolvedValue([]);
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Employment History'));
      await waitFor(() => expect(screen.getByText('No employment history')).toBeInTheDocument());
    });

    it('When Rate History is empty / Then empty state is shown', async () => {
      mockPeople.getRateHistory.mockResolvedValue([]);
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Rate History'));
      await waitFor(() => expect(screen.getByText('No rate history')).toBeInTheDocument());
    });

    it('When Goals are empty / Then empty state is shown', async () => {
      mockGoals.getAll.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Goals'));
      await waitFor(() => expect(screen.getByText('No goals')).toBeInTheDocument());
    });
  });

  describe('Given the employee record fetch fails', () => {
    beforeEach(() => {
      mockPeople.getById.mockRejectedValue(new Error('Network error'));
      mockAlloc.getAll.mockResolvedValue({ data: [] });
      mockTime.getEntries.mockResolvedValue({ data: [] });
    });

    it('When the detail fetch rejects / Then it shows an error state instead of a blank page', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Unable to load employee details.')).toBeInTheDocument());
      expect(screen.getByText('Back to list')).toBeInTheDocument();
    });

    it('When Back to list is clicked in the error state / Then it navigates to the shell-scoped list path', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Back to list')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Back to list'));
      expect(mockNavigate).toHaveBeenCalledWith('/people/people');
    });
  });

  describe('Given the employee id resolves to no record', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue(null);
      mockAlloc.getAll.mockResolvedValue({ data: [] });
      mockTime.getEntries.mockResolvedValue({ data: [] });
    });

    it('When the record is empty / Then it shows the not-found state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Person not found.')).toBeInTheDocument());
    });

    it('When Back to list is clicked in the not-found state / Then it navigates to the shell-scoped list path', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Back to list')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Back to list'));
      expect(mockNavigate).toHaveBeenCalledWith('/people/people');
    });
  });

  describe('Given the person loads but secondary data fails', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue({
        id: 'p1', full_name: 'Bob Jones', type: 'employee', status: 'active',
        cost_rate: 40, cost_rate_unit: 'hour', currency: 'USD', available_hours_per_day: 8,
        people_roles: [],
      });
      mockAlloc.getAll.mockRejectedValue(new Error('allocations down'));
      mockTime.getEntries.mockRejectedValue(new Error('time entries down'));
    });

    it('When allocations and time entries reject / Then the profile still renders (no blank page)', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Bob Jones')).toBeInTheDocument());
      // Allocations tab still works and shows its empty state rather than crashing.
      fireEvent.click(screen.getByText('Allocations'));
      await waitFor(() => expect(screen.getByText('No allocations')).toBeInTheDocument());
    });
  });

  describe('Given the person record is missing optional fields', () => {
    beforeEach(() => {
      // full_name intentionally null — the previous code crashed on .split(' ') here.
      mockPeople.getById.mockResolvedValue({
        id: 'p1', full_name: null, type: 'employee', status: 'active',
        cost_rate: 0, cost_rate_unit: 'hour', currency: 'USD', available_hours_per_day: 8,
        people_roles: [],
      });
      mockAlloc.getAll.mockResolvedValue({ data: [] });
      mockTime.getEntries.mockResolvedValue({ data: [] });
    });

    it('When full_name is null / Then the page renders a fallback instead of crashing', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Unknown')).toBeInTheDocument());
    });
  });
});
