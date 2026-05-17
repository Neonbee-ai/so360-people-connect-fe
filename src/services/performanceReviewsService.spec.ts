import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { performanceReviewsApi } from './performanceReviewsService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given performanceReviewsApi.getAll', () => {
  it('When called without params / Then it calls GET /performance-reviews', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await performanceReviewsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/performance-reviews', undefined);
  });

  it('When called with status filter / Then it passes the filter', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await performanceReviewsApi.getAll({ status: 'completed' });
    expect(mockApi.get).toHaveBeenCalledWith('/performance-reviews', { status: 'completed' });
  });
});

describe('Given performanceReviewsApi.create', () => {
  it('When called with payload / Then it calls POST /performance-reviews', async () => {
    const payload = {
      person_id: 'p1',
      template_id: 'tpl1',
      reviewer_id: 'p2',
      review_period_start: '2024-01-01',
      review_period_end: '2024-03-31',
    };
    mockApi.post.mockResolvedValue({ id: 'rv1', ...payload, status: 'draft' });
    await performanceReviewsApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/performance-reviews', payload);
  });
});

describe('Given performanceReviewsApi.submitSelfReview', () => {
  it('When called with id and data / Then it calls the self-review endpoint', async () => {
    const reviewData = { q1: 'Good', q2: 4 };
    mockApi.post.mockResolvedValue({ id: 'rv1', status: 'manager_review_pending' });
    await performanceReviewsApi.submitSelfReview('rv1', reviewData);
    expect(mockApi.post).toHaveBeenCalledWith(
      '/performance-reviews/rv1/submit-self-review',
      { self_review_data: reviewData }
    );
  });
});

describe('Given performanceReviewsApi.submitManagerReview', () => {
  it('When called with id, data and rating / Then it calls the manager-review endpoint', async () => {
    const reviewData = { q1: 'Excellent' };
    mockApi.post.mockResolvedValue({ id: 'rv1', overall_rating: 4.5 });
    await performanceReviewsApi.submitManagerReview('rv1', reviewData, 4.5);
    expect(mockApi.post).toHaveBeenCalledWith(
      '/performance-reviews/rv1/submit-manager-review',
      { manager_review_data: reviewData, overall_rating: 4.5 }
    );
  });
});

describe('Given performanceReviewsApi.complete', () => {
  it('When called with id / Then it calls the complete endpoint', async () => {
    mockApi.post.mockResolvedValue({ id: 'rv1', status: 'completed' });
    await performanceReviewsApi.complete('rv1');
    expect(mockApi.post).toHaveBeenCalledWith('/performance-reviews/rv1/complete', {});
  });
});

describe('Given performanceReviewsApi.getMyReviews', () => {
  it('When called / Then it calls GET /performance-reviews/my-reviews', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await performanceReviewsApi.getMyReviews();
    expect(mockApi.get).toHaveBeenCalledWith('/performance-reviews/my-reviews');
  });
});
