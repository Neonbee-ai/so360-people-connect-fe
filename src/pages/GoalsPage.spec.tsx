import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/goalsService', () => ({
  goalsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

import GoalsPage from './GoalsPage';
import { goalsApi } from '../services/goalsService';

const mockApi = goalsApi as any;

const renderPage = () => render(<MemoryRouter><GoalsPage /></MemoryRouter>);

const mockGoal = {
  id: 'g1',
  person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' },
  title: 'Complete 10 deals',
  goal_type: 'individual',
  target_date: '2024-12-31',
  priority: 'high',
  status: 'in_progress',
  progress_percentage: 40,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given GoalsPage loads successfully', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockGoal], total: 1 });
  });

  it('When page loads / Then "Goals" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Goals')).toBeInTheDocument());
  });

  it('When goals are fetched / Then goal title is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Complete 10 deals')).toBeInTheDocument());
  });

  it('When goals are fetched / Then person name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('When goals are fetched / Then progress percentage is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/40%/)).toBeInTheDocument());
  });
});

describe('Given GoalsPage with no goals', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no goals exist / Then empty state is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No goals/i)).toBeInTheDocument());
  });
});

describe('Given GoalsPage status filter', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockGoal], total: 1 });
  });

  it('When status filter changes / Then API is called with new status', async () => {
    renderPage();
    await waitFor(() => expect(mockApi.getAll).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'completed' } });
    await waitFor(() =>
      expect(mockApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }))
    );
  });
});

describe('Given GoalsPage API failure', () => {
  beforeEach(() => {
    mockApi.getAll.mockRejectedValue(new Error('Failed'));
  });

  it('When API fails / Then error toast is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load goals')).toBeInTheDocument());
  });
});
