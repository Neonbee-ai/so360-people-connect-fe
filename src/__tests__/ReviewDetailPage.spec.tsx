import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: { getById: vi.fn(), submitSelfReview: vi.fn(), submitManagerReview: vi.fn(), complete: vi.fn() },
  PerformanceReview: {},
}));

vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: { getById: vi.fn() },
  ReviewTemplate: {},
}));


vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

import ReviewDetailPage from '../pages/ReviewDetailPage';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';

const mockReviews = performanceReviewsApi as any;
const mockTemplates = reviewTemplatesApi as any;

const renderPage = (id = 'r1') => render(
  <MemoryRouter initialEntries={[`/reviews/${id}`]}>
    <Routes>
      <Route path="/reviews/:id" element={<ReviewDetailPage />} />
      <Route path="/reviews" element={<div>Reviews List</div>} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => vi.resetAllMocks());

describe('ReviewDetailPage', () => {
  describe('Given a review with template exists', () => {
    beforeEach(() => {
      mockReviews.getById.mockResolvedValue({
        id: 'r1', person_id: 'p1', template_id: 't1', reviewer_id: 'rv1',
        review_period_start: '2025-01-01', review_period_end: '2025-12-31',
        status: 'self_review_pending', overall_rating: null,
        self_review_data: null, manager_review_data: null,
        self_review_submitted_at: null, manager_review_submitted_at: null,
        self_review_deadline: '2025-06-01', manager_review_deadline: '2025-06-30',
        person: { full_name: 'Alice', job_title: 'Dev' },
        template: { name: 'Annual Review', review_type: 'annual' },
        reviewer: { full_name: 'Manager Bob' },
      });
      mockTemplates.getById.mockResolvedValue({
        id: 't1', name: 'Annual Review', rating_scale: 5,
        sections: [
          {
            id: 's1', title: 'Core Competencies', description: 'Rate core skills', weight: 60,
            fields: [
              { type: 'rating', label: 'Technical Skills', max: 5, required: true },
              { type: 'textarea', label: 'Comments', required: false },
            ],
          },
        ],
      });
    });

    it('When the page loads / Then it shows review info', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText(/Alice - Annual Review/)).toBeInTheDocument());
      expect(screen.getByText('Manager Bob')).toBeInTheDocument();
    });

    it('When the page loads / Then it renders the template form', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Core Competencies')).toBeInTheDocument());
      expect(screen.getByText('Technical Skills')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows Submit Self Review button', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Submit Self Review')).toBeInTheDocument());
    });
  });

  describe('Given a completed review with rating', () => {
    beforeEach(() => {
      mockReviews.getById.mockResolvedValue({
        id: 'r2', person_id: 'p1', template_id: 't1', reviewer_id: 'rv1',
        review_period_start: '2025-01-01', review_period_end: '2025-12-31',
        status: 'completed', overall_rating: 4.2,
        self_review_data: { 's1__Technical Skills': 4 },
        manager_review_data: { 's1__Technical Skills': 5 },
        self_review_submitted_at: '2025-06-10',
        manager_review_submitted_at: '2025-06-20',
        person: { full_name: 'Charlie' },
        template: { name: 'Annual' },
        reviewer: { full_name: 'Dave' },
      });
      mockTemplates.getById.mockResolvedValue({
        id: 't1', name: 'Annual', rating_scale: 5, sections: [],
      });
    });

    it('When the page loads / Then it shows the overall rating', async () => {
      renderPage('r2');
      await waitFor(() => expect(screen.getByText('4.2')).toBeInTheDocument());
    });
  });

  describe('Given a review in manager_review_pending status', () => {
    beforeEach(() => {
      mockReviews.getById.mockResolvedValue({
        id: 'r3', person_id: 'p1', template_id: 't1', reviewer_id: 'rv1',
        review_period_start: '2025-01-01', review_period_end: '2025-12-31',
        status: 'manager_review_pending', overall_rating: null,
        self_review_data: { 's1__Technical Skills': 4, 's1__Comments': 'Good progress' },
        manager_review_data: null,
        self_review_submitted_at: '2025-06-10',
        manager_review_submitted_at: null,
        self_review_deadline: '2025-06-01',
        manager_review_deadline: '2025-06-30',
        person: { full_name: 'Alice', job_title: 'Dev' },
        template: { name: 'Annual Review', review_type: 'annual' },
        reviewer: { full_name: 'Manager Bob' },
      });
      mockTemplates.getById.mockResolvedValue({
        id: 't1', name: 'Annual Review', rating_scale: 5,
        sections: [
          {
            id: 's1', title: 'Core Competencies', description: 'Rate core skills', weight: 60,
            fields: [
              { type: 'rating', label: 'Technical Skills', max: 5, required: true },
              { type: 'textarea', label: 'Comments', required: false },
              { type: 'text', label: 'Summary', required: false },
              { type: 'number', label: 'Score', required: false },
              { type: 'checkbox', label: 'Recommend', required: false },
            ],
          },
        ],
      });
    });

    it('When the page loads / Then it shows manager review button', async () => {
      renderPage('r3');
      await waitFor(() => expect(screen.getByText(/Alice - Annual Review/)).toBeInTheDocument());
      expect(screen.getByText('Submit Manager Review')).toBeInTheDocument();
    });

    it('When the page loads / Then it renders all field types', async () => {
      renderPage('r3');
      await waitFor(() => expect(screen.getByText('Technical Skills')).toBeInTheDocument());
      expect(screen.getByText('Comments')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
      expect(screen.getByText('Recommend')).toBeInTheDocument();
    });

    it('When self review tab is clicked / Then it shows self review data in read-only', async () => {
      renderPage('r3');
      await waitFor(() => expect(screen.getByText('Self Review')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Self Review'));
      await waitFor(() => expect(screen.getByText('Core Competencies')).toBeInTheDocument());
    });
  });

  describe('Given a draft review with no template', () => {
    beforeEach(() => {
      mockReviews.getById.mockResolvedValue({
        id: 'r4', person_id: 'p1', template_id: null, reviewer_id: 'rv1',
        review_period_start: '2025-01-01', review_period_end: '2025-12-31',
        status: 'draft', overall_rating: null,
        self_review_data: null, manager_review_data: null,
        self_review_submitted_at: null, manager_review_submitted_at: null,
        person: { full_name: 'Eve' },
        template: { name: 'Quick Review' },
        reviewer: { full_name: 'Frank' },
      });
    });

    it('When the page loads / Then it shows review info without template form', async () => {
      renderPage('r4');
      await waitFor(() => expect(screen.getByText(/Eve/)).toBeInTheDocument());
    });
  });

  describe('Given the review is not found', () => {
    beforeEach(() => {
      mockReviews.getById.mockRejectedValue(new Error('Not found'));
    });

    it('When loading fails / Then it shows review not found', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Review not found')).toBeInTheDocument());
    });
  });
});
