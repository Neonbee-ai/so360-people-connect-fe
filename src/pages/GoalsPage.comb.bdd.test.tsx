import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';
import GoalsPage from './GoalsPage';
import { goalsApi } from '../services/goalsService';

vi.mock('../services/goalsService', () => ({
  goalsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateProgress: vi.fn(), complete: vi.fn() },
}));
vi.mock('../services/peopleService', () => ({ peopleApi: { getAll: vi.fn().mockResolvedValue({ data: [] }), getMe: vi.fn().mockResolvedValue(null) } }));
let flagEnabled = true;
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => flagEnabled, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    toBusinessDate: (d: any) => String(d).slice(0, 10), businessToday: () => '2026-09-15',
    startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`), endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
    formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}`, formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

const api = goalsApi as any;
const goal = { id: 'g1', person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' }, title: 'Complete 10 deals', goal_type: 'individual', target_date: '2024-12-31', priority: 'high', status: 'in_progress', progress_percentage: 40 };
const renderPage = () => render(<MemoryRouter><GoalsPage /></MemoryRouter>);

describe('GoalsPage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagEnabled = true;
    api.getAll.mockResolvedValue({ data: [goal], total: 1 });
  });

  it('Given goals exist / When the page loads / Then the title, row and primary action render', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Complete 10 deals')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create Goal/ })).toBeInTheDocument();
  });

  it('Given no goals / When loaded / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No goals found')).toBeInTheDocument());
  });

  it('Given the create flag is off / When loaded / Then Create Goal is hidden', async () => {
    flagEnabled = false;
    renderPage();
    await waitFor(() => expect(screen.getByText('Complete 10 deals')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Create Goal/ })).not.toBeInTheDocument();
  });

  it('Given the status filter / When changed / Then the API is called with that status', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Complete 10 deals')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    await waitFor(() => expect(api.getAll).toHaveBeenLastCalledWith({ status: 'completed' }));
  });

  it('Given the create modal is open / When Cancel is clicked / Then it closes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Complete 10 deals')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Create Goal/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Given the API fails / When loading / Then an error toast is raised', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.getAll.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load goals'));
  });
});
