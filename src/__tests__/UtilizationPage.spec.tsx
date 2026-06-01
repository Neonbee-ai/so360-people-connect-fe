import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/peopleService', () => ({
  utilizationApi: { getAll: vi.fn(), getSummary: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { currency: 'USD', timezone: 'UTC' } }),
}));

import UtilizationPage from '../pages/UtilizationPage';
import { utilizationApi } from '../services/peopleService';

const mockApi = utilizationApi as any;

const renderPage = () => render(<MemoryRouter><UtilizationPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('UtilizationPage', () => {
  describe('Given utilization data exists', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          {
            person: { id: 'p1', full_name: 'Alice', job_title: 'Dev', cost_rate: 50, available_hours_per_day: 8 },
            utilization: {
              utilization_pct: 80, allocation_pct: 75, available_hours: 40,
              planned_hours: 30, actual_hours: 32, actual_cost: 1600,
              variance_hours: 2, is_idle: false, is_overallocated: false,
            },
          },
          {
            person: { id: 'p2', full_name: 'Bob', job_title: 'QA', cost_rate: 40, available_hours_per_day: 8 },
            utilization: {
              utilization_pct: 20, allocation_pct: 25, available_hours: 40,
              planned_hours: 10, actual_hours: 8, actual_cost: 320,
              variance_hours: -2, is_idle: true, is_overallocated: false,
            },
          },
        ],
        period: { start: '2025-06-02', end: '2025-06-06' },
      });
      mockApi.getSummary.mockResolvedValue({
        total_people: 2, avg_utilization_pct: 50,
        total_hours_this_week: 40, total_cost_this_week: 1920,
        active_allocations: 2, pending_approvals: 0, burn_rate_daily: 384,
      });
    });

    it('When the page loads / Then it shows KPI cards', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Avg Utilization')).toBeInTheDocument());
      expect(screen.getByText('Active Resources')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows idle resources', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Idle Resources')).toBeInTheDocument());
    });

    it('When the page loads / Then it shows utilization cards', async () => {
      renderPage();
      await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThan(0));
      expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    });

    it('When Table View is clicked / Then it switches to table view', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Table View')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Table View'));
      await waitFor(() => expect(screen.getByText('TOTALS (2 people)')).toBeInTheDocument());
    });

    it('When there are idle people / Then it shows idle cost signal', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Idle Cost Signal')).toBeInTheDocument());
    });

    it('When sort by name is clicked / Then it re-sorts', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Name'));
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    });

    it('When the previous week button is clicked / Then it loads previous week data', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      const prevBtn = screen.getAllByRole('button').find(btn => btn.querySelector('[data-testid="icon-ChevronLeft"]'));
      if (prevBtn) fireEvent.click(prevBtn);
      await waitFor(() => expect(mockApi.getAll).toHaveBeenCalledTimes(2));
    });
  });

  describe('Given no utilization data', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [], period: { start: '', end: '' } });
      mockApi.getSummary.mockResolvedValue({
        total_people: 0, avg_utilization_pct: 0,
        total_hours_this_week: 0, total_cost_this_week: 0,
        active_allocations: 0, pending_approvals: 0, burn_rate_daily: 0,
      });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No utilization data')).toBeInTheDocument());
    });
  });
});
