import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/peopleService', () => ({
  utilizationApi: { getSummary: vi.fn() },
  timeEntriesApi: { getAll: vi.fn() },
  eventsApi: { getAll: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { currency: 'USD', timezone: 'UTC' } }),
}));

import DashboardPage from './DashboardPage';
import { utilizationApi, timeEntriesApi, eventsApi } from '../services/peopleService';

const mockUtil = utilizationApi as any;
const mockTime = timeEntriesApi as any;
const mockEvents = eventsApi as any;

const renderPage = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockNavigate.mockReset();
});

describe('Given DashboardPage with full data', () => {
  beforeEach(() => {
    mockUtil.getSummary.mockResolvedValue({
      total_people: 10,
      avg_utilization_pct: 72,
      total_hours_this_week: 340,
      total_cost_this_week: 17000,
      active_allocations: 5,
      pending_approvals: 2,
      burn_rate_daily: 3400,
    });
    mockTime.getAll.mockResolvedValue({
      data: [
        { id: 'te1', person: { full_name: 'Alice' }, entity_name: 'Project X', entity_type: 'project', hours: 8, status: 'approved', description: 'Dev work' },
      ],
    });
    mockEvents.getAll.mockResolvedValue({
      data: [
        { id: 'ev1', event_type: 'person_created', actor_name: 'Admin', occurred_at: new Date().toISOString(), payload: { full_name: 'Bob' } },
      ],
    });
  });

  it('When the page loads / Then the heading "People Connect" is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('People Connect')).toBeInTheDocument());
  });

  it('When summary loads / Then KPI stat cards are rendered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Active People')).toBeInTheDocument());
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('When summary loads / Then utilization is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('72%')).toBeInTheDocument());
  });

  it('When time entries load / Then person name is shown in recent entries', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('When events load / Then activity feed contains "New Person"', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('New Person')).toBeInTheDocument());
  });
});

describe('Given DashboardPage with empty data', () => {
  beforeEach(() => {
    mockUtil.getSummary.mockResolvedValue({
      total_people: 0,
      avg_utilization_pct: 0,
      total_hours_this_week: 0,
      total_cost_this_week: 0,
      active_allocations: 0,
      pending_approvals: 0,
      burn_rate_daily: 0,
    });
    mockTime.getAll.mockResolvedValue({ data: [] });
    mockEvents.getAll.mockResolvedValue({ data: [] });
  });

  it('When there are no time entries / Then empty state text appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No time entries yet')).toBeInTheDocument());
  });

  it('When there are no events / Then activity feed empty state appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No events yet')).toBeInTheDocument());
  });
});

describe('Given DashboardPage API failure', () => {
  beforeEach(() => {
    mockUtil.getSummary.mockRejectedValue(new Error('Network error'));
    mockTime.getAll.mockRejectedValue(new Error('Network error'));
    mockEvents.getAll.mockRejectedValue(new Error('Network error'));
  });

  it('When all APIs fail / Then the page still renders without crashing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('People Connect')).toBeInTheDocument());
  });
});

/**
 * BDD specs: "Add Person" button on the Dashboard navigates to the correct
 * People Registry path (/people/people) so the Create Person modal can open.
 *
 * Regression: the button previously called navigate('/people', ...) which
 * resolved to the MFE root route, triggered its <Navigate to="dashboard">
 * redirect, and discarded the { openCreate: true } state — leaving the modal
 * permanently closed. The fix targets /people/people (the full shell path for
 * the People Registry page).
 */
describe('Given the Add Person button on the Dashboard', () => {
  beforeEach(() => {
    mockUtil.getSummary.mockResolvedValue({
      total_people: 3,
      avg_utilization_pct: 60,
      total_hours_this_week: 80,
      total_cost_this_week: 4000,
      active_allocations: 2,
      pending_approvals: 0,
      burn_rate_daily: 800,
    });
    mockTime.getAll.mockResolvedValue({ data: [] });
    mockEvents.getAll.mockResolvedValue({ data: [] });
  });

  it('When the page loads / Then the Add Person button is visible', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add person/i })).toBeInTheDocument(),
    );
  });

  it('When clicked / Then it navigates to /people/people with openCreate:true in state', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /add person/i }));
    fireEvent.click(screen.getByRole('button', { name: /add person/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/people/people', { state: { openCreate: true } });
  });

  it('When clicked / Then it does NOT navigate to bare /people (regression guard: was routing to MFE root, discarding openCreate state)', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /add person/i }));
    fireEvent.click(screen.getByRole('button', { name: /add person/i }));
    expect(mockNavigate).not.toHaveBeenCalledWith('/people', expect.anything());
  });

  it('When clicked / Then exactly one navigation call is made', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /add person/i }));
    fireEvent.click(screen.getByRole('button', { name: /add person/i }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
