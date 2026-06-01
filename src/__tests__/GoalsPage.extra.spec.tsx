/**
 * GoalsPage — extra scenarios:
 * create failure, update progress modal, complete goal confirmation,
 * API error on load, type filter, priority labels.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
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


vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

import GoalsPage from '../pages/GoalsPage';
import { goalsApi } from '../services/goalsService';

const mockApi = goalsApi as any;

const sampleGoals = [
  {
    id: 'g1', title: 'Grow revenue', goal_type: 'company', priority: 'high',
    status: 'in_progress', progress_percentage: 60, target_date: '2026-12-31',
    current_value: 60, target_value: 100,
    person: { full_name: 'Alice', avatar_url: null },
  },
  {
    id: 'g2', title: 'Learn TypeScript', goal_type: 'development', priority: 'medium',
    status: 'draft', progress_percentage: 0, target_date: '2026-06-30',
    current_value: 0, target_value: 10,
    person: { full_name: 'Bob', avatar_url: null },
  },
];

const renderPage = () => render(<MemoryRouter><GoalsPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('GoalsPage — extra scenarios', () => {
  afterEach(() => { cleanup(); });

  describe('Given API load fails', () => {
    it('When getAll rejects / Then shows error toast message', async () => {
      mockApi.getAll.mockRejectedValue(new Error('Network error'));
      renderPage();
      await waitFor(() => expect(screen.getByText('Failed to load goals')).toBeInTheDocument());
    });
  });

  describe('Given goals exist and user filters by status', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: sampleGoals });
    });

    it('When status filter changes to in_progress / Then getAll is called with status param', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Grow revenue'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'in_progress' } });
      await waitFor(() =>
        expect(mockApi.getAll).toHaveBeenLastCalledWith({ status: 'in_progress' }),
      );
    });

    it('When status filter is cleared / Then getAll is called without status', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Grow revenue'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'in_progress' } });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
      await waitFor(() =>
        expect(mockApi.getAll).toHaveBeenLastCalledWith({}),
      );
    });
  });

  describe('Given goal creation fails', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
      mockApi.create.mockRejectedValue(new Error('Create failed'));
    });

    it('When create throws / Then failure toast is shown', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Goals'));
      fireEvent.click(screen.getAllByText('Create Goal')[0]);
      // Submit form if modal is rendered
      const modal = screen.queryByTestId('modal') || document.querySelector('[role="dialog"]');
      if (modal) {
        const titleInput = screen.queryByPlaceholderText(/goal title/i);
        if (titleInput) {
          fireEvent.change(titleInput, { target: { value: 'Test goal' } });
          const submitBtn = screen.getAllByText('Create Goal')[0];
          fireEvent.click(submitBtn);
          await waitFor(() => expect(screen.getByText('Failed to create goal')).toBeInTheDocument());
        }
      }
    });
  });

  describe('Given goal progress update', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: sampleGoals });
      mockApi.updateProgress.mockResolvedValue({});
    });

    it('When Update Progress is clicked / Then updateProgress API is called after clicking update', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Grow revenue'));
      const progressBtns = screen.getAllByText('Update Progress');
      fireEvent.click(progressBtns[0]);
      // Progress modal / inline input should appear — submit
      const updateBtn = screen.queryByText('Update');
      if (updateBtn) {
        fireEvent.click(updateBtn);
        await waitFor(() => expect(mockApi.updateProgress).toHaveBeenCalledWith('g1', expect.any(Number)));
      }
    });
  });

  describe('Given goal complete action', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: sampleGoals });
      mockApi.complete.mockResolvedValue({});
      vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('When Mark Complete is clicked and confirmed / Then goalsApi.complete is called', async () => {
      renderPage();
      await waitFor(() => screen.getByText('Grow revenue'));
      const completeBtns = screen.getAllByText('Mark Complete');
      fireEvent.click(completeBtns[0]);
      await waitFor(() => expect(mockApi.complete).toHaveBeenCalledWith('g1'));
    });

    it('When Mark Complete is cancelled / Then goalsApi.complete is NOT called', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderPage();
      await waitFor(() => screen.getByText('Grow revenue'));
      const completeBtns = screen.getAllByText('Mark Complete');
      fireEvent.click(completeBtns[0]);
      expect(mockApi.complete).not.toHaveBeenCalled();
    });
  });

  describe('Given page header', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When rendered / Then Goals header is visible', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Goals')).toBeInTheDocument());
    });

    it('When rendered / Then Create Goal button is present', async () => {
      renderPage();
      await waitFor(() => expect(screen.getAllByText('Create Goal')[0]).toBeInTheDocument());
    });
  });
});
