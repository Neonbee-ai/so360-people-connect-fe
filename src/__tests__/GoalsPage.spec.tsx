import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/goalsService', () => ({
  goalsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateProgress: vi.fn(),
    complete: vi.fn(),
  },
  Goal: {},
  CreateGoalPayload: {},
}));

import GoalsPage from '../pages/GoalsPage';
import { goalsApi } from '../services/goalsService';

const mockApi = goalsApi as any;

const renderPage = () =>
  render(<MemoryRouter><GoalsPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('GoalsPage', () => {
  describe('Given the API returns goals', () => {
    const goals = [
      { id: 'g1', title: 'Increase revenue', goal_type: 'company', priority: 'high', status: 'in_progress', progress_percentage: 60, target_date: '2026-12-31', current_value: 60, target_value: 100, person: { full_name: 'Alice', avatar_url: null } },
      { id: 'g2', title: 'Learn TypeScript', goal_type: 'development', priority: 'medium', status: 'draft', progress_percentage: 0, target_date: '2026-06-30', current_value: 0, target_value: 10, person: { full_name: 'Bob', avatar_url: null } },
    ];

    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: goals });
    });

    it('When the page loads / Then it renders goal cards', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Increase revenue')).toBeInTheDocument());
      expect(screen.getByText('Learn TypeScript')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows progress percentages', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('60%')).toBeInTheDocument());
    });

    it('When the page loads / Then it shows goal type badges', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('company')).toBeInTheDocument());
      expect(screen.getByText('development')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows priority labels', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('high')).toBeInTheDocument());
    });

    it('When the status filter is changed / Then goals are re-fetched', async () => {
      renderPage();
      await waitFor(() => expect(mockApi.getAll).toHaveBeenCalledTimes(1));
      fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'in_progress' } });
      await waitFor(() => expect(mockApi.getAll).toHaveBeenCalledWith({ status: 'in_progress' }));
    });

    it('When the Create Goal button is clicked / Then the create modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Increase revenue')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Create Goal'));
      await waitFor(() => expect(screen.getByPlaceholderText('Increase sales by 20%')).toBeInTheDocument());
    });
  });

  describe('Given no goals exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then the empty state is shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No goals found')).toBeInTheDocument());
    });
  });
});
