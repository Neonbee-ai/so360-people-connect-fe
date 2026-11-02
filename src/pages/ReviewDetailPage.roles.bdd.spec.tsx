import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: {
    getById: vi.fn(),
    submitSelfReview: vi.fn(),
    submitManagerReview: vi.fn(),
    complete: vi.fn(),
  },
  PerformanceReview: {},
  ReviewTemplateSection: {},
}));

// The appraisal evidence panel is a child of this page, so its service must
// be mocked here too — otherwise it reaches the real apiClient during render
// and takes the whole page down with it.
vi.mock('../services/performanceBlocksService', () => ({
  performanceBlocksApi: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../services/peopleService', () => ({ peopleApi: { getMe: vi.fn() } }));

vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: { getById: vi.fn() },
  ReviewTemplate: {},
  ReviewTemplateSection: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    // Date-only primitives — this factory is a CLOSED LIST, so a component that
    // adopts formatters.businessToday()/toBusinessDate() throws here otherwise.
    toBusinessDate: (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)),
    businessToday: () => '2026-09-15',
    startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`),
    endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

import ReviewDetailPage from './ReviewDetailPage';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';
import { peopleApi } from '../services/peopleService';

const tpl = { id: 'tpl1', name: 'Annual', review_type: 'annual', rating_scale: 5, sections: [{ id: 's1', title: 'Skills', fields: [{ type: 'rating', label: 'Quality', max: 5 }] }] };
const review = {
  id: 'rv1', person_id: 'emp1', reviewer_id: 'mgr1',
  person: { id: 'emp1', full_name: 'Alice' }, reviewer: { id: 'mgr1', full_name: 'Bob' },
  template: { id: 'tpl1', name: 'Annual', review_type: 'annual' }, template_id: 'tpl1',
  review_period_start: '2024-01-01', review_period_end: '2024-12-31',
  status: 'self_review_pending', self_review_data: null, manager_review_data: null,
};

const renderAs = async (meId: string) => {
  (performanceReviewsApi as any).getById.mockResolvedValue(review);
  (reviewTemplatesApi as any).getById.mockResolvedValue(tpl);
  (peopleApi as any).getMe.mockResolvedValue({ id: meId });
  render(<MemoryRouter initialEntries={['/reviews/rv1']}><Routes><Route path="/reviews/:id" element={<ReviewDetailPage />} /></Routes></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0));
};

beforeEach(() => { vi.resetAllMocks(); });
describe('Given role-based review sections (Pulse cac0fab5)', () => {
  it('When the employee opens their review / Then the Manager Review tab is hidden and Submit Self Review is offered', async () => {
    await renderAs('emp1');
    await waitFor(() => expect(screen.queryByRole('tab', { name: /^Manager Review/ })).not.toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /^Self Review/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Self Review' })).toBeInTheDocument();
  });

  it('When someone other than the subject opens an unsubmitted review / Then Self Review is hidden and they cannot submit it', async () => {
    await renderAs('admin1');
    await waitFor(() => expect(screen.queryByRole('tab', { name: /^Self Review/ })).not.toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /^Manager Review/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Self Review' })).not.toBeInTheDocument();
  });

  it('When the viewer profile cannot be resolved / Then both sections stay visible (display fails open)', async () => {
    (performanceReviewsApi as any).getById.mockResolvedValue(review);
    (reviewTemplatesApi as any).getById.mockResolvedValue(tpl);
    (peopleApi as any).getMe.mockRejectedValue(new Error('no profile'));
    render(<MemoryRouter initialEntries={['/reviews/rv1']}><Routes><Route path="/reviews/:id" element={<ReviewDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('tab', { name: /^Self Review/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Manager Review/ })).toBeInTheDocument();
  });
});
