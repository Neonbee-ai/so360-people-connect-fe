import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  utilizationApi: { getAll: vi.fn(), getSummary: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useBusinessSettings: () => ({ settings: { currency: 'USD', timezone: 'UTC' } }),
}));

import UtilizationPage from './UtilizationPage';
import { utilizationApi } from '../services/peopleService';
import { toast } from '@so360/design-system';

const api = utilizationApi as any;
const renderPage = () => render(<MemoryRouter><UtilizationPage /></MemoryRouter>);

const row = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  person: { id, full_name: name, email: `${id}@t.com`, job_title: 'Engineer', status: 'active', cost_rate: 100, available_hours_per_day: 8 },
  utilization: {
    available_hours: 40, planned_hours: 32, actual_hours: 30, actual_cost: 3000,
    utilization_pct: 75, allocation_pct: 80, variance_hours: 2, is_idle: false, is_overallocated: false, ...over,
  },
});
const period = { start: '2024-06-10', end: '2024-06-14' };
const summary = { total_people: 10, active_allocations: 8, avg_utilization_pct: 72, total_hours_this_week: 340, total_cost_this_week: 17000, pending_approvals: 2, burn_rate_daily: 3400, period };

describe('Given the Utilization page on the Comb template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAll.mockResolvedValue({ data: [row('p1', 'Alice Smith')], period });
    api.getSummary.mockResolvedValue(summary);
  });

  it('When it loads / Then the title, KPIs and refresh action render', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Utilization Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Active Resources')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('When data is still loading / Then a busy status is shown', () => {
    api.getAll.mockReturnValue(new Promise(() => {}));
    api.getSummary.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { hidden: true })).toHaveAttribute('aria-busy', 'true');
  });

  it('When there are no people / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue({ data: [], period });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No utilization data/i)).toBeInTheDocument());
  });

  it('When Refresh is clicked / Then both utilization APIs are called again', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(api.getAll).toHaveBeenCalledTimes(2));
    expect(api.getSummary).toHaveBeenCalledTimes(2);
  });

  it('When it loads / Then the totals line is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/TOTALS \(1 people\)/)).toBeInTheDocument());
  });

  it('When someone is idle / Then the idle cost signal banner appears', async () => {
    api.getAll.mockResolvedValue({ data: [row('p2', 'Idle Ian', { is_idle: true, utilization_pct: 10 })], period });
    renderPage();
    await waitFor(() => expect(screen.getByText('Idle Cost Signal')).toBeInTheDocument());
  });

  it('When the previous-week arrow is clicked / Then data is requested for the earlier week', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    await waitFor(() => expect(api.getAll).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Next week' })).not.toBeDisabled();
  });

  it('When the API fails / Then an error toast is shown', async () => {
    api.getAll.mockRejectedValue(new Error('x'));
    const spy = vi.spyOn(toast, 'error');
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load utilization data'));
  });
});
