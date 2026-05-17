import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  PerformanceReview: {},
  CreatePerformanceReviewPayload: {},
}));

vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: { getAll: vi.fn() },
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
}));

import PerformanceReviewsPage from './PerformanceReviewsPage';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';
import { peopleApi } from '../services/peopleService';

const mockReviewsApi = performanceReviewsApi as any;
const mockTemplatesApi = reviewTemplatesApi as any;
const mockPeopleApi = peopleApi as any;

const renderPage = () => render(<MemoryRouter><PerformanceReviewsPage /></MemoryRouter>);

const mockReview = {
  id: 'rv1',
  person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' },
  template: { id: 'tpl1', name: 'Annual 2024', review_type: 'annual' },
  reviewer: { id: 'p2', full_name: 'Manager Bob' },
  review_period_start: '2024-01-01',
  review_period_end: '2024-12-31',
  status: 'draft',
  created_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockTemplatesApi.getAll.mockResolvedValue({ data: [] });
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
});

describe('Given PerformanceReviewsPage loads with reviews', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [mockReview], total: 1 });
  });

  it('When page loads / Then "Performance Reviews" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Performance Reviews')).toBeInTheDocument());
  });

  it('When reviews are fetched / Then person name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('When reviews are fetched / Then template name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual 2024')).toBeInTheDocument());
  });
});

describe('Given PerformanceReviewsPage with no reviews', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no reviews exist / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No performance reviews/i)).toBeInTheDocument());
  });
});

describe('Given PerformanceReviewsPage API failure', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockRejectedValue(new Error('Server error'));
  });

  it('When API fails / Then page renders without crashing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Performance Reviews')).toBeInTheDocument());
  });
});

describe('Given PerformanceReviewsPage status filter', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [mockReview], total: 1 });
  });

  it('When status filter changes / Then API is called with new status', async () => {
    renderPage();
    await waitFor(() => expect(mockReviewsApi.getAll).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'completed' } });
    await waitFor(() =>
      expect(mockReviewsApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }))
    );
  });
});
