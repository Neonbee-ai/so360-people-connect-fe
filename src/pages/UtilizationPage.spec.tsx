import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  utilizationApi: {
    getAll: vi.fn(),
    getSummary: vi.fn(),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { currency: 'USD', timezone: 'UTC' } }),
}));

import UtilizationPage from './UtilizationPage';
import { utilizationApi } from '../services/peopleService';
import { toast } from '@so360/design-system';

const mockApi = utilizationApi as any;

const renderPage = () => render(<MemoryRouter><UtilizationPage /></MemoryRouter>);

const mockUtilData = {
  person: {
    id: 'p1',
    full_name: 'Alice Smith',
    email: 'alice@test.com',
    job_title: 'Engineer',
    status: 'active',
    cost_rate: 100,
    available_hours_per_day: 8,
  },
  utilization: {
    available_hours: 40,
    planned_hours: 32,
    actual_hours: 30,
    actual_cost: 3000,
    utilization_pct: 75,
    allocation_pct: 80,
    variance_hours: 2,
    is_idle: false,
    is_overallocated: false,
  },
};

const mockSummary = {
  total_people: 10,
  active_allocations: 8,
  avg_utilization_pct: 72,
  total_hours_this_week: 340,
  total_cost_this_week: 17000,
  pending_approvals: 2,
  burn_rate_daily: 3400,
  period: { start: '2024-06-10', end: '2024-06-14' },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given UtilizationPage loads with data', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockUtilData], period: { start: '2024-06-10', end: '2024-06-14' } });
    mockApi.getSummary.mockResolvedValue(mockSummary);
  });

  it('When page loads / Then "Utilization" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Utilization Intelligence')).toBeInTheDocument());
  });

  it('When summary loads / Then stat cards are shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Active Resources')).toBeInTheDocument());
  });

  it('When utilization data loads / Then person name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When utilization data loads / Then utilization percentage is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/75%/)).toBeInTheDocument());
  });
});

describe('Given UtilizationPage with no utilization data', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], period: { start: '2024-06-10', end: '2024-06-14' } });
    mockApi.getSummary.mockResolvedValue(mockSummary);
  });

  it('When no utilization data exists / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No utilization data/i)).toBeInTheDocument());
  });
});

// Regression coverage for the reported crash:
// "TypeError: Cannot read properties of undefined (reading 'utilization_pct')"
// thrown inside the sort comparator when a record is missing/incomplete
// (e.g. no allocation/timesheet data for that employee for the period).
describe('Given UtilizationPage receives incomplete/malformed utilization records', () => {
  const completeRecord = {
    person: { id: 'p-complete', full_name: 'Complete Carla', email: 'carla@test.com', job_title: 'Lead', status: 'active', cost_rate: 90, available_hours_per_day: 8 },
    utilization: {
      available_hours: 40, planned_hours: 32, actual_hours: 28, actual_cost: 2520,
      utilization_pct: 70, allocation_pct: 80, variance_hours: -4, is_idle: false, is_overallocated: false,
    },
  };
  // A record whose nested `utilization` object is entirely missing — this is
  // exactly the shape that made `a.utilization.utilization_pct` throw inside
  // the sort comparator.
  const recordMissingUtilization = {
    person: { id: 'p-no-util', full_name: 'No Util Nate', email: 'nate@test.com', job_title: 'Analyst', status: 'active', cost_rate: 60, available_hours_per_day: 8 },
  } as any;

  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({
      data: [completeRecord, recordMissingUtilization, null, undefined],
      period: { start: '2024-06-10', end: '2024-06-14' },
    });
    mockApi.getSummary.mockResolvedValue(mockSummary);
  });

  it('When a record has no `.utilization` object / Then the page renders without throwing (default sort)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Utilization Intelligence')).toBeInTheDocument());
    expect(screen.getByText('Complete Carla')).toBeInTheDocument();
  });

  it('When sorting by utilization with a record missing `.utilization` / Then the sort does not throw and both people still render', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Complete Carla')).toBeInTheDocument());
    // Toggling the sort direction re-runs the comparator against the same
    // (incomplete) data set — this is where the reported crash occurred.
    fireEvent.click(screen.getByRole('button', { name: /Utilization/ }));
    expect(screen.getByText('Complete Carla')).toBeInTheDocument();
    expect(screen.getByText('No Util Nate')).toBeInTheDocument();
  });

  it('When sorting by name with a record missing `.utilization` / Then it does not throw', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Complete Carla')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Name'));
    expect(screen.getByText('Complete Carla')).toBeInTheDocument();
  });

  it('When switching to Table View with an incomplete record / Then totals render as finite numbers, not NaN%', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Table View')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Table View'));
    await waitFor(() => expect(screen.getByText(/TOTALS/)).toBeInTheDocument());
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});

describe('Given UtilizationPage receives only null/undefined records', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [null, undefined], period: { start: '2024-06-10', end: '2024-06-14' } });
    mockApi.getSummary.mockResolvedValue(mockSummary);
  });

  it('When every record is null/undefined / Then the empty state renders instead of crashing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No utilization data/i)).toBeInTheDocument());
  });
});

describe('Given UtilizationPage API failure', () => {
  beforeEach(() => {
    mockApi.getAll.mockImplementation(async () => { throw new Error('Failed'); });
    mockApi.getSummary.mockImplementation(async () => { throw new Error('Failed'); });
  });

  it('When API fails / Then error toast appears', async () => {
    const toastErrorSpy = vi.spyOn(toast, 'error');
    renderPage();
    await waitFor(() => expect(screen.getByText('Utilization Intelligence')).toBeInTheDocument());
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalledWith('Failed to load utilization data'));
  });
});

/*
 * Layout consistency of the resource cards.
 *
 * Available/Actual/Cost previously sat in an auto-width column, so a longer
 * cost value pushed the whole metric block — and with it the progress bars —
 * out of line with the card above. Variance was also conditional, giving cards
 * two different footer baselines.
 */
describe('Given resource cards are rendered on the Utilization page', () => {
  const person = (id: string, name: string, over: Record<string, unknown> = {}) => ({
    person: { ...mockUtilData.person, id, full_name: name },
    utilization: { ...mockUtilData.utilization, ...over },
  });

  const cardFor = (name: string) =>
    screen.getByText(name).closest('div.rounded-xl') as HTMLElement;

  beforeEach(() => {
    mockApi.getSummary.mockResolvedValue(mockSummary);
  });

  it('When cost values differ in length / Then every card uses the same fixed metrics column width', async () => {
    mockApi.getAll.mockResolvedValue({
      data: [
        person('p1', 'Short Cost', { actual_cost: 5 }),
        person('p2', 'Very Long Cost', { actual_cost: 1234567 }),
      ],
      period: { start: '2024-06-10', end: '2024-06-14' },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Very Long Cost')).toBeInTheDocument());

    const widths = ['Short Cost', 'Very Long Cost'].map(name => {
      const metrics = cardFor(name).querySelector('.grid-cols-3') as HTMLElement;
      return Array.from(metrics.classList).find(c => c.startsWith('w-['));
    });
    expect(widths[0]).toBeDefined();
    expect(widths[0]).toBe(widths[1]);
  });

  it('When variance is zero / Then the footer row is still rendered so baselines match', async () => {
    mockApi.getAll.mockResolvedValue({
      data: [person('p1', 'Zero Variance', { variance_hours: 0 })],
      period: { start: '2024-06-10', end: '2024-06-14' },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Zero Variance')).toBeInTheDocument());

    expect(screen.getByText('Variance:')).toBeInTheDocument();
    expect(screen.getByText('0h vs planned')).toBeInTheDocument();
  });

  it('When a name is long / Then the status badge still sits in its own right-hand slot', async () => {
    mockApi.getAll.mockResolvedValue({
      data: [person('p1', 'Bartholomew Featherstonehaugh-Montgomery', { is_idle: true })],
      period: { start: '2024-06-10', end: '2024-06-14' },
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Idle').length).toBeGreaterThan(0));

    const badge = screen.getAllByText('Idle').find(el => el.className.includes('rounded'))!;
    // ml-auto pins the badge group right, independent of the name's length.
    expect((badge.parentElement as HTMLElement).className).toContain('ml-auto');
  });

  it('When the sort controls render / Then each option occupies the same fixed width', async () => {
    mockApi.getAll.mockResolvedValue({ data: [person('p1', 'Alice Smith')], period: { start: '2024-06-10', end: '2024-06-14' } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Sort by:')).toBeInTheDocument());

    ['Utilization', 'Name', 'Cost'].forEach(label => {
      const button = screen.getByRole('button', { name: new RegExp(`^${label}`) });
      expect(button.className).toContain('min-w-[92px]');
    });
  });
});
