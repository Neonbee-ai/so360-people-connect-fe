import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: {
    getAll: vi.fn(),
    getMyReviews: vi.fn(),
    create: vi.fn(),
  },
  PerformanceReview: {},
  CreatePerformanceReviewPayload: {},
}));
vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  ReviewTemplate: {},
}));
vi.mock('../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));


vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),}));

import PerformanceReviewsPage from '../pages/PerformanceReviewsPage';
import { performanceReviewsApi } from '../services/performanceReviewsService';

const mockApi = performanceReviewsApi as any;

const renderPage = () =>
  render(<MemoryRouter><PerformanceReviewsPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('PerformanceReviewsPage', () => {
  describe('Given reviews are loaded', () => {
    const reviews = [
      { id: 'r1', status: 'completed', overall_rating: 4.5, review_period_start: '2026-01-01', review_period_end: '2026-06-30', person: { full_name: 'Alice', job_title: 'Engineer', avatar_url: null }, template: { name: 'Annual', review_type: 'annual' } },
      { id: 'r2', status: 'self_review_pending', overall_rating: null, review_period_start: '2026-01-01', review_period_end: '2026-06-30', person: { full_name: 'Bob', job_title: 'Designer', avatar_url: null }, template: { name: 'Quarterly', review_type: 'quarterly' } },
    ];

    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: reviews });
      mockApi.getMyReviews.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it renders the reviews table', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows rating for completed reviews', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('4.5')).toBeInTheDocument());
    });

    it('When the page loads / Then it renders status badges', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('completed')).toBeInTheDocument());
      expect(screen.getByText('self review_pending')).toBeInTheDocument();
    });

    it('When the My Reviews tab is clicked / Then my reviews are fetched', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      fireEvent.click(screen.getByText('My Reviews'));
      await waitFor(() => expect(mockApi.getMyReviews).toHaveBeenCalled());
    });

    it('When a review row is clicked / Then it navigates to the detail', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Alice'));
      expect(mockNavigate).toHaveBeenCalledWith('/reviews/r1');
    });
  });

  describe('Given no reviews exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then the empty state is shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No performance reviews found')).toBeInTheDocument());
    });
  });
});
