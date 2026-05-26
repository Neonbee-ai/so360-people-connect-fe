import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: {
    getPendingApprovals: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
  LeaveRequest: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

import LeaveApprovalsPage from './LeaveApprovalsPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';

const mockApi = leaveRequestsApi as any;

const renderPage = () => render(<MemoryRouter><LeaveApprovalsPage /></MemoryRouter>);

const mockRequest = {
  id: 'lr1',
  person: { id: 'p1', full_name: 'Alice', email: 'alice@test.com' },
  leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL' },
  start_date: '2024-07-01',
  end_date: '2024-07-05',
  total_days: 5,
  status: 'pending',
  reason: 'Family vacation',
  created_at: '2024-06-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given LeaveApprovalsPage loads with pending requests', () => {
  beforeEach(() => {
    mockApi.getPendingApprovals.mockResolvedValue({ data: [mockRequest], total: 1 });
  });

  it('When page loads / Then "Pending Approvals" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Pending Approvals')).toBeInTheDocument());
  });

  it('When pending requests are fetched / Then person name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('When pending requests are fetched / Then leave type is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
  });

  it('When pending requests are fetched / Then Approve button is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument());
  });

  it('When pending requests are fetched / Then Reject button is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Reject')).toBeInTheDocument());
  });
});

describe('Given LeaveApprovalsPage with no pending requests', () => {
  beforeEach(() => {
    mockApi.getPendingApprovals.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no pending requests exist / Then empty state is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No pending/i)).toBeInTheDocument());
  });
});

describe('Given LeaveApprovalsPage API failure', () => {
  beforeEach(() => {
    mockApi.getPendingApprovals.mockRejectedValue(new Error('Failed'));
  });

  it('When API fails / Then error toast is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load pending approvals')).toBeInTheDocument());
  });
});
