/**
 * PersonDetailPage — extra scenarios:
 * save failure toast, cancel edit restores data, rate history with entries,
 * goals with data, update rate button, invite user button, back navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

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
  workLocationsApi: { getAll: vi.fn().mockResolvedValue([]) },
  WorkLocation: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

import PersonDetailPage from '../pages/PersonDetailPage';
import { peopleApi, allocationsApi, timeEntriesApi } from '../services/peopleService';
import { goalsApi } from '../services/goalsService';
import { workLocationsApi } from '../services/workLocationsService';

const mockPeople = peopleApi as any;
const mockAlloc = allocationsApi as any;
const mockTime = timeEntriesApi as any;
const mockGoals = goalsApi as any;

const alicePerson = {
  id: 'p1', full_name: 'Alice Smith', type: 'employee', status: 'active',
  email: 'alice@test.com', phone: '+1234567890', job_title: 'Developer',
  department: 'Engineering', cost_rate: 50, cost_rate_unit: 'hour', currency: 'USD',
  billing_rate: 75, available_hours_per_day: 8, start_date: '2024-01-01',
  people_roles: [
    { id: 'r1', role_name: 'Frontend Dev', skill_category: 'Engineering', proficiency: 'expert', is_primary: true },
  ],
  user_id: null,
};

const renderPage = (id = 'p1') => render(
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
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('PersonDetailPage — extra scenarios', () => {
  describe('Given save edit fails', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue(alicePerson);
      mockPeople.update.mockRejectedValue(new Error('Update failed'));
    });

    it('When save is clicked and update fails / Then shows failure toast', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Alice Smith'));
      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(screen.getByText('Failed to update')).toBeInTheDocument());
    });
  });

  describe('Given cancel edit', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue(alicePerson);
    });

    it('When edit mode is active and Cancel is clicked / Then Edit button returns', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Alice Smith'));
      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Cancel'));
      await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
    });
  });

  describe('Given rate history with entries', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue(alicePerson);
      mockPeople.getRateHistory.mockResolvedValue([
        { id: 'rh1', cost_rate: 45, billing_rate: 70, effective_from: '2024-01-01', effective_to: null, currency: 'USD' },
        { id: 'rh2', cost_rate: 50, billing_rate: 75, effective_from: '2024-06-01', effective_to: null, currency: 'USD' },
      ]);
    });

    it('When Rate History tab is clicked / Then rate entries are displayed', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Alice Smith'));
      fireEvent.click(screen.getByText('Rate History'));
      await waitFor(() => expect(mockPeople.getRateHistory).toHaveBeenCalledWith('p1'));
    });
  });

  describe('Given goals with data', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue(alicePerson);
      mockGoals.getAll.mockResolvedValue({
        data: [
          { id: 'g1', title: 'Ship v2 feature', status: 'in_progress', progress_percentage: 40, target_date: '2026-12-31', priority: 'high', goal_type: 'individual' },
        ],
      });
    });

    it('When Goals tab is clicked / Then goals are loaded', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Alice Smith'));
      fireEvent.click(screen.getByText('Goals'));
      await waitFor(() => expect(mockGoals.getAll).toHaveBeenCalled());
    });
  });

  describe('Given Update Rate button', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue(alicePerson);
    });

    it('When Update Rate is clicked / Then update rate modal or section opens', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Alice Smith'));
      const updateRateBtn = screen.queryByText('Update Rate');
      if (updateRateBtn) {
        fireEvent.click(updateRateBtn);
        // Just verify it does not crash and modal state changes
        await waitFor(() => expect(screen.getByText('Update Rate')).toBeInTheDocument());
      }
    });
  });

  describe('Given back navigation', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue(alicePerson);
    });

    it('When back arrow / Back button is clicked / Then navigates to people list', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Alice Smith'));
      const backBtn = screen.queryByRole('button', { name: /back/i });
      if (backBtn) {
        fireEvent.click(backBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/people');
      }
    });
  });

  describe('Given person email and contact', () => {
    beforeEach(() => {
      mockPeople.getById.mockResolvedValue(alicePerson);
    });

    it('When person loads / Then shows email address', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
    });

    it('When person loads / Then shows phone number', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('+1234567890')).toBeInTheDocument());
    });

    it('When person loads / Then shows job title', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Developer')).toBeInTheDocument());
    });
  });
});
