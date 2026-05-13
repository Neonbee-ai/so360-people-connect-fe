import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: { getAll: vi.fn() },
  PerformanceReview: {},
}));

vi.mock('../services/goalsService', () => ({
  goalsApi: { getAll: vi.fn() },
  Goal: {},
}));

import TeamPerformancePage from '../pages/TeamPerformancePage';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { goalsApi } from '../services/goalsService';

const mockReviews = performanceReviewsApi as any;
const mockGoals = goalsApi as any;

const renderPage = () => render(<MemoryRouter><TeamPerformancePage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('TeamPerformancePage', () => {
  describe('Given performance data exists', () => {
    beforeEach(() => {
      mockReviews.getAll.mockResolvedValue({
        data: [
          { id: 'r1', status: 'completed', overall_rating: 4.5, person: { full_name: 'Alice', job_title: 'Dev' } },
          { id: 'r2', status: 'completed', overall_rating: 3.8, person: { full_name: 'Bob', job_title: 'QA' } },
          { id: 'r3', status: 'draft', overall_rating: null, person: { full_name: 'Charlie' } },
        ],
      });
      mockGoals.getAll.mockResolvedValue({
        data: [
          { id: 'g1', status: 'in_progress', progress_percentage: 60, title: 'Goal 1' },
          { id: 'g2', status: 'completed', progress_percentage: 100, title: 'Goal 2' },
        ],
      });
    });

    it('When the page loads / Then it shows stat cards', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Avg Rating')).toBeInTheDocument());
      expect(screen.getByText('Completed Reviews')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows rating distribution', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Rating Distribution')).toBeInTheDocument());
    });

    it('When the page loads / Then it shows top performers', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Top Performers')).toBeInTheDocument());
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows goals summary', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Goals Summary')).toBeInTheDocument());
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows review pipeline', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Review Pipeline')).toBeInTheDocument());
    });
  });

  describe('Given no data exists', () => {
    beforeEach(() => {
      mockReviews.getAll.mockResolvedValue({ data: [] });
      mockGoals.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows dash for avg rating', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('-')).toBeInTheDocument());
    });

    it('When the page loads / Then it shows no reviews message', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No completed reviews yet')).toBeInTheDocument());
    });
  });
});
