import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: {
    getPendingApprovals: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    getById: vi.fn().mockResolvedValue({ id: 'lr1', approvals: [] }),
  },
  LeaveRequest: {},
}));

const flags = { approve: true };
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: () => flags.approve,
    hasPermission: () => true,
    currentTenant: { id: 't' },
    currentOrg: { id: 'o' },
  }),
}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
  }),
}));

import LeaveApprovalsPage from './LeaveApprovalsPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { toast } from '@so360/design-system';

const api = leaveRequestsApi as any;
const request = {
  id: 'lr1',
  person: { id: 'p1', full_name: 'Alice', email: 'alice@test.com' },
  leave_type: { id: 'lt1', name: 'Annual Leave' },
  start_date: '2024-07-01',
  end_date: '2024-07-05',
  total_days: 5,
  status: 'pending',
};
const renderPage = () => render(<MemoryRouter><LeaveApprovalsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  flags.approve = true;
  api.getById.mockResolvedValue({ id: 'lr1', approvals: [] });
  api.getPendingApprovals.mockResolvedValue({ data: [request] });
});

describe('LeaveApprovalsPage (Comb)', () => {
  it('Given pending requests / When loaded / Then title and row actions show', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Pending Approvals' })).toBeInTheDocument();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('Given no requests / When loaded / Then the empty state shows', async () => {
    api.getPendingApprovals.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText('No pending approvals')).toBeInTheDocument();
  });

  it('Given the approve flag is off / When loaded / Then only Review is offered', async () => {
    flags.approve = false;
    renderPage();
    await screen.findByText('Alice');
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('Given a request / When Reject is filled and submitted / Then reject API gets the reason', async () => {
    api.reject.mockResolvedValue({});
    renderPage();
    await screen.findByText('Alice');
    fireEvent.click(screen.getByText('Reject'));
    fireEvent.change(await screen.findByPlaceholderText('Please provide a reason for rejection...'), { target: { value: 'No cover' } });
    fireEvent.click(screen.getByText('Reject Request'));
    await waitFor(() => expect(api.reject).toHaveBeenCalledWith('lr1', 'No cover'));
  });

  it('Given a request / When Review is clicked / Then the read-only modal opens and loads detail', async () => {
    renderPage();
    await screen.findByText('Alice');
    fireEvent.click(screen.getByText('Review'));
    await waitFor(() => expect(api.getById).toHaveBeenCalledWith('lr1'));
    expect(await screen.findByText('Leave Request')).toBeInTheDocument();
  });

  it('Given the API fails / When loaded / Then an error toast shows', async () => {
    api.getPendingApprovals.mockRejectedValue(new Error('x'));
    const spy = vi.spyOn(toast, 'error');
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load pending approvals'));
  });
});
