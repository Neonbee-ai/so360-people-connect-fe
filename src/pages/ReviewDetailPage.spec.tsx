import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

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

vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: { getById: vi.fn() },
  ReviewTemplate: {},
  ReviewTemplateSection: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
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

const mockReviewsApi = performanceReviewsApi as any;
const mockTemplatesApi = reviewTemplatesApi as any;

const renderPage = (id = 'rv1') =>
  render(
    <MemoryRouter initialEntries={[`/reviews/${id}`]}>
      <Routes>
        <Route path="/reviews/:id" element={<ReviewDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

const mockTemplate = {
  id: 'tpl1',
  name: 'Annual 2024',
  review_type: 'annual',
  rating_scale: 5,
  requires_self_review: true,
  requires_manager_review: true,
  sections: [
    {
      id: 's1',
      title: 'Technical Skills',
      fields: [{ type: 'rating', label: 'Code Quality', max: 5, required: true }],
    },
  ],
};

const mockReview = {
  id: 'rv1',
  person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' },
  template: { id: 'tpl1', name: 'Annual 2024', review_type: 'annual' },
  reviewer: { id: 'p2', full_name: 'Manager Bob' },
  template_id: 'tpl1',
  review_period_start: '2024-01-01',
  review_period_end: '2024-12-31',
  status: 'self_review_pending',
  self_review_data: null,
  manager_review_data: null,
  created_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given ReviewDetailPage loads successfully', () => {
  beforeEach(() => {
    mockReviewsApi.getById.mockResolvedValue(mockReview);
    mockTemplatesApi.getById.mockResolvedValue(mockTemplate);
  });

  it('When page loads / Then "Performance Review" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /Alice - Annual 2024/i })).toBeInTheDocument());
  });

  it('When review is loaded / Then person name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /Alice/i })).toBeInTheDocument());
  });

  it('When review is loaded / Then template name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /Annual 2024/i })).toBeInTheDocument());
  });

  it('When review is loaded / Then reviewer name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Manager Bob')).toBeInTheDocument());
  });
});

describe('Given ReviewDetailPage API failure', () => {
  beforeEach(() => {
    mockReviewsApi.getById.mockImplementation(async () => { throw new Error('Not found'); });
    mockTemplatesApi.getById.mockResolvedValue(mockTemplate);
  });

  it('When review load fails / Then error toast appears', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Review not found')).toBeInTheDocument()
    );
  });
});

describe('Given ReviewDetailPage with template sections', () => {
  beforeEach(() => {
    mockReviewsApi.getById.mockResolvedValue(mockReview);
    mockTemplatesApi.getById.mockResolvedValue(mockTemplate);
  });

  it('When template sections load / Then section title is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Technical Skills')).toBeInTheDocument());
  });
});
