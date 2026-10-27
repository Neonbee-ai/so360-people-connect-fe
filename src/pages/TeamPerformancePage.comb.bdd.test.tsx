import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
import TeamPerformancePage from './TeamPerformancePage';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { goalsApi } from '../services/goalsService';

vi.mock('../services/performanceReviewsService', () => ({ performanceReviewsApi: { getAll: vi.fn() } }));
vi.mock('../services/goalsService', () => ({ goalsApi: { getAll: vi.fn() } }));

const reviews = performanceReviewsApi as any;
const goals = goalsApi as any;
const renderPage = () => render(<MemoryRouter><TeamPerformancePage /></MemoryRouter>);

describe('TeamPerformancePage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviews.getAll.mockResolvedValue({ data: [
      { id: 'rv1', status: 'completed', overall_rating: 4, person: { full_name: 'Alice' } },
      { id: 'rv2', status: 'self_review_pending', person: { full_name: 'Bob' } },
    ] });
    goals.getAll.mockResolvedValue({ data: [
      { id: 'g1', status: 'in_progress', progress_percentage: 60, title: 'Increase sales' },
      { id: 'g2', status: 'completed', progress_percentage: 100, title: 'Launch product' },
    ] });
  });

  it('Given data exists / When loaded / Then the title and KPI cards render', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Team Performance' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Avg Rating')).toBeInTheDocument());
    expect(screen.getByText('Completed Reviews')).toBeInTheDocument();
    expect(screen.getByText('Pending Reviews')).toBeInTheDocument();
  });

  it('Given data exists / When loaded / Then the section cards render', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Rating Distribution')).toBeInTheDocument());
    expect(screen.getByText('Top Performers')).toBeInTheDocument();
    expect(screen.getByText('Goals Summary')).toBeInTheDocument();
    expect(screen.getByText('Review Pipeline')).toBeInTheDocument();
  });

  it('Given a completed review / When loaded / Then the top performer is listed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThan(0));
  });

  it('Given no reviews / When loaded / Then the pipeline shows its empty text', async () => {
    reviews.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No reviews in pipeline')).toBeInTheDocument());
  });

  it('Given the APIs fail / When loading / Then an error toast is raised', async () => {
    const spy = vi.spyOn(toast, 'error');
    reviews.getAll.mockRejectedValue(new Error('boom'));
    goals.getAll.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load performance data'));
  });
});
