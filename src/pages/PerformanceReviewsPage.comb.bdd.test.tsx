import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';
import PerformanceReviewsPage from './PerformanceReviewsPage';
import { performanceReviewsApi } from '../services/performanceReviewsService';

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: { getAll: vi.fn(), getMyReviews: vi.fn(), getEligibleReviewers: vi.fn().mockResolvedValue({ data: [], direct_manager_id: null }), create: vi.fn(), delete: vi.fn() },
}));
vi.mock('../services/reviewTemplatesService', () => ({ reviewTemplatesApi: { getAll: vi.fn().mockResolvedValue({ data: [] }), seedDefaults: vi.fn() } }));
vi.mock('../services/peopleService', () => ({ peopleApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) } }));
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

const api = performanceReviewsApi as any;
const review = { id: 'rv1', person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' }, template: { id: 'tpl1', name: 'Annual 2024', review_type: 'annual' }, reviewer: { id: 'p2', full_name: 'Manager Bob' }, review_period_start: '2024-01-01', review_period_end: '2024-12-31', status: 'draft', created_at: '2024-01-01T00:00:00Z' };
const renderPage = () => render(<MemoryRouter><PerformanceReviewsPage /></MemoryRouter>);

describe('PerformanceReviewsPage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagEnabled = true;
    api.getAll.mockResolvedValue({ data: [review], total: 1 });
    api.getMyReviews.mockResolvedValue({ data: [review], total: 1 });
  });

  it('Given reviews exist / When loaded / Then title, row and primary action render', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Performance Reviews' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create Review/ })).toBeInTheDocument();
  });

  it('Given no reviews / When loaded / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No performance reviews found')).toBeInTheDocument());
  });

  it('Given the create flag is off / When loaded / Then Create Review is hidden', async () => {
    flagEnabled = false;
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Create Review/ })).not.toBeInTheDocument();
  });

  it('Given the My Reviews tab / When selected / Then the my-reviews endpoint is used', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /My Reviews/ }));
    await waitFor(() => expect(api.getMyReviews).toHaveBeenCalled());
  });

  it('Given the create modal is open / When Cancel is clicked / Then it closes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Create Review/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Given the API fails / When loading / Then an error toast is raised', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.getAll.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load performance reviews'));
  });
});
