import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: { getAll: vi.fn() },
  PerformanceReview: {},
}));

vi.mock('../services/goalsService', () => ({
  goalsApi: { getAll: vi.fn() },
  Goal: {},
}));

import TeamPerformancePage from './TeamPerformancePage';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { goalsApi } from '../services/goalsService';

const mockReviewsApi = performanceReviewsApi as any;
const mockGoalsApi = goalsApi as any;

const renderPage = () => render(<MemoryRouter><TeamPerformancePage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given TeamPerformancePage loads with data', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({
      data: [
        { id: 'rv1', status: 'completed', overall_rating: 4, person: { full_name: 'Alice' } },
        { id: 'rv2', status: 'self_review_pending', person: { full_name: 'Bob' } },
      ],
    });
    mockGoalsApi.getAll.mockResolvedValue({
      data: [
        { id: 'g1', status: 'in_progress', progress_percentage: 60, title: 'Increase sales' },
        { id: 'g2', status: 'completed', progress_percentage: 100, title: 'Launch product' },
      ],
    });
  });

  it('When page loads / Then "Team Performance" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Team Performance')).toBeInTheDocument());
  });

  it('When data loads / Then stat cards are shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Avg Rating')).toBeInTheDocument());
  });

  it('When reviews are loaded / Then completed count is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Completed Reviews')).toBeInTheDocument());
  });

  it('When goals are loaded / Then active goals stat is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Avg Goal Progress')).toBeInTheDocument());
  });
});

describe('Given TeamPerformancePage with no data', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [] });
    mockGoalsApi.getAll.mockResolvedValue({ data: [] });
  });

  it('When no data exists / Then stat cards show zero values', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Team Performance')).toBeInTheDocument());
    // Stats still render with 0 values
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
  });
});

describe('Given TeamPerformancePage API failure', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockImplementation(async () => { throw new Error('Failed'); });
    mockGoalsApi.getAll.mockImplementation(async () => { throw new Error('Failed'); });
  });

  it('When APIs fail / Then error toast appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Team Performance')).toBeInTheDocument());
    expect(screen.getByText('Failed to load performance data')).toBeInTheDocument();
  });
});
