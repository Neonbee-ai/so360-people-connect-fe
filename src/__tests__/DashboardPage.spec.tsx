import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/peopleService', () => ({
  utilizationApi: { getSummary: vi.fn() },
  eventsApi: { getAll: vi.fn() },
}));

vi.mock('../services/timesheetApi', () => ({
  timesheetApi: { getEntries: vi.fn(), getUtilization: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { currency: 'USD', timezone: 'UTC' } }),
}));

import DashboardPage from '../pages/DashboardPage';
import { utilizationApi, eventsApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';

const mockUtil = utilizationApi as any;
const mockTimesheet = timesheetApi as any;
const mockEvents = eventsApi as any;

const renderPage = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('DashboardPage', () => {
  describe('Given API returns dashboard data', () => {
    beforeEach(() => {
      mockUtil.getSummary.mockResolvedValue({
        total_people: 12,
        avg_utilization_pct: 72,
        total_hours_this_week: 340,
        total_cost_this_week: 17000,
        active_allocations: 8,
        pending_approvals: 2,
        burn_rate_daily: 3400,
      });
      mockTimesheet.getEntries.mockResolvedValue({
        data: [
          { id: 'te1', entity_name: 'Project X', entity_type: 'project', entry_date: '2026-06-08', hours: 8, status: 'approved', description: 'Dev work' },
        ],
      });
      mockEvents.getAll.mockResolvedValue({
        data: [
          { id: 'e1', event_type: 'person_created', actor_name: 'Admin', occurred_at: new Date().toISOString(), payload: { full_name: 'Bob' } },
        ],
      });
    });

    it('When the page loads / Then it renders KPI cards', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Active People')).toBeInTheDocument());
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('72%')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows recent timesheet entries', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Project X')).toBeInTheDocument());
      expect(screen.getByText('8h')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows the activity feed', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('New Person')).toBeInTheDocument());
    });
  });

  describe('Given API returns data with low utilization', () => {
    beforeEach(() => {
      mockUtil.getSummary.mockResolvedValue({
        total_people: 5,
        avg_utilization_pct: 30,
        total_hours_this_week: 100,
        total_cost_this_week: 5000,
        active_allocations: 2,
        pending_approvals: 5,
        burn_rate_daily: 1000,
      });
      mockTimesheet.getEntries.mockResolvedValue({ data: [] });
      mockEvents.getAll.mockResolvedValue({ data: [] });
    });

    it('When utilization is below 50% / Then it shows the attention alert', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Attention Required')).toBeInTheDocument());
    });

    it('When there are no time entries / Then it shows empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No time entries yet')).toBeInTheDocument());
    });

    it('When there are no events / Then it shows empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No events yet')).toBeInTheDocument());
    });
  });

  describe('Given API calls fail', () => {
    beforeEach(() => {
      mockUtil.getSummary.mockRejectedValue(new Error('fail'));
      mockTimesheet.getEntries.mockRejectedValue(new Error('fail'));
      mockEvents.getAll.mockRejectedValue(new Error('fail'));
    });

    it('When all APIs fail / Then it still renders without crashing', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('People Connect')).toBeInTheDocument());
    });
  });
});
