import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
import DashboardPage from './DashboardPage';
import { utilizationApi, eventsApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';

vi.mock('../services/peopleService', () => ({ utilizationApi: { getSummary: vi.fn() }, eventsApi: { getAll: vi.fn() } }));
vi.mock('../services/timesheetApi', () => ({ timesheetApi: { getEntries: vi.fn(), getUtilization: vi.fn() } }));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { currency: 'USD', timezone: 'UTC' } }),
}));

const util = utilizationApi as any;
const ts = timesheetApi as any;
const events = eventsApi as any;
const renderPage = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

describe('DashboardPage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    util.getSummary.mockResolvedValue({ total_people: 10, avg_utilization_pct: 72, total_hours_this_week: 340, total_cost_this_week: 17000, active_allocations: 5, pending_approvals: 2, burn_rate_daily: 3400 });
    ts.getEntries.mockResolvedValue({ data: [{ id: 'te1', entity_name: 'Project X', entity_type: 'project', entry_date: '2026-06-08', hours: 8, status: 'approved', description: 'Dev work' }] });
    events.getAll.mockResolvedValue({ data: [{ id: 'ev1', event_type: 'person_created', actor_name: 'Admin', occurred_at: new Date().toISOString(), payload: { full_name: 'Bob' } }] });
  });

  it('Given summary data / When loaded / Then the title and KPI values render', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'People Connect' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Active People')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('72%')).toBeInTheDocument());
  });

  it('Given timesheet entries / When loaded / Then the recent entries card lists them', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Project X')).toBeInTheDocument());
    expect(ts.getEntries).toHaveBeenCalledWith({ limit: 5 });
  });

  it('Given the Add Person action / When clicked / Then it navigates to People with openCreate', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Add Person/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/people/people', { state: { openCreate: true } });
  });

  it('Given recent entries / When View all is clicked / Then it navigates to time', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('View all'));
    expect(mockNavigate).toHaveBeenCalledWith('/people/time');
  });

  it('Given pending approvals / When Review now is clicked / Then it navigates to time', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Review now'));
    expect(mockNavigate).toHaveBeenCalledWith('/people/time');
  });
});
