import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
import ReviewDetailPage from './ReviewDetailPage';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: { getById: vi.fn(), submitSelfReview: vi.fn(), submitManagerReview: vi.fn(), complete: vi.fn() },
}));
vi.mock('../services/performanceBlocksService', () => ({ performanceBlocksApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../services/reviewTemplatesService', () => ({ reviewTemplatesApi: { getById: vi.fn() } }));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
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

const reviews = performanceReviewsApi as any;
const templates = reviewTemplatesApi as any;
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/reviews/rv1']}>
      <Routes><Route path="/reviews/:id" element={<ReviewDetailPage />} /></Routes>
    </MemoryRouter>,
  );

const template = { id: 'tpl1', name: 'Annual 2024', review_type: 'annual', rating_scale: 5, requires_self_review: true, requires_manager_review: true, sections: [{ id: 's1', title: 'Technical Skills', fields: [{ type: 'rating', label: 'Code Quality', max: 5, required: true }] }] };
const review = { id: 'rv1', person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' }, template: { id: 'tpl1', name: 'Annual 2024', review_type: 'annual' }, reviewer: { id: 'p2', full_name: 'Manager Bob' }, template_id: 'tpl1', review_period_start: '2024-01-01', review_period_end: '2024-12-31', status: 'self_review_pending', self_review_data: null, manager_review_data: null, created_at: '2024-01-01T00:00:00Z' };

describe('ReviewDetailPage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviews.getById.mockResolvedValue(review);
    templates.getById.mockResolvedValue(template);
  });

  it('Given a review / When loaded / Then the title combines person and template', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /Alice - Annual 2024/ })).toBeInTheDocument();
    expect(screen.getByText('Manager Bob')).toBeInTheDocument();
  });

  it('Given a template with sections / When loaded / Then the section title renders', async () => {
    renderPage();
    expect(await screen.findByText('Technical Skills')).toBeInTheDocument();
  });

  it('Given the review is loaded / When the tabs render / Then self, manager and overall are available', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Alice/ });
    expect(screen.getAllByRole('tab').length).toBe(3);
  });

  it('Given the header / When Back is clicked / Then it navigates inside the module', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Alice/ });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Reviews' }));
    expect(mockNavigate).toHaveBeenCalledWith('/people/reviews');
  });

  it('Given the review fails to load / When rendered / Then the not-found message shows', async () => {
    reviews.getById.mockRejectedValue(new Error('Not found'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Review not found')).toBeInTheDocument());
  });
});
