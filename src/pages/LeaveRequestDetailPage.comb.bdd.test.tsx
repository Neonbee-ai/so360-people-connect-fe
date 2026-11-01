import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getById: vi.fn(), getBalances: vi.fn(), approve: vi.fn(), reject: vi.fn() },
  LeaveRequest: {},
  LeaveBalance: {},
}));

const perms = { approve: true };
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: () => true,
    hasPermission: () => perms.approve,
  }),
}));
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({ formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '' }),
}));

import LeaveRequestDetailPage from './LeaveRequestDetailPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { toast } from '@so360/design-system';

const api = leaveRequestsApi as any;
const request = {
  id: 'lr1', person_id: 'p1', leave_type_id: 'lt1', status: 'pending',
  start_date: '2026-07-01', end_date: '2026-07-02', total_days: 2, reason: 'Trip',
  person: { full_name: 'Alice' }, leave_type: { name: 'Annual Leave' }, approvals: [],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/leaves/requests/lr1']}>
    <Routes><Route path="/leaves/requests/:id" element={<LeaveRequestDetailPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.resetAllMocks();
  perms.approve = true;
  api.getById.mockResolvedValue(request);
  api.getBalances.mockResolvedValue({ data: [{ leave_type_id: 'lt1', available: 7 }] });
});

describe('LeaveRequestDetailPage (Comb)', () => {
  it('Given a request / When loaded / Then title, status and balance show', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Leave Request' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('leave-status')).toHaveTextContent('pending'));
    expect(await screen.findByTestId('leave-balance')).toHaveTextContent('7');
  });

  it('Given loading / When pending / Then the skeleton placeholder shows', () => {
    api.getById.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('leave-detail-loading')).toBeInTheDocument();
  });

  it('Given no request / When API returns null / Then not-found state shows', async () => {
    api.getById.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText('Leave request not found')).toBeInTheDocument();
  });

  it('Given an approver / When Approve is clicked / Then approve API is called with the id', async () => {
    api.approve.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByText('Approve'));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith('lr1'));
  });

  it('Given no approve permission / When loaded / Then decision buttons are hidden', async () => {
    perms.approve = false;
    renderPage();
    await screen.findByTestId('leave-status');
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('Given approve fails / When Approve is clicked / Then an error toast shows', async () => {
    api.approve.mockRejectedValue(new Error('x'));
    const spy = vi.spyOn(toast, 'error');
    renderPage();
    fireEvent.click(await screen.findByText('Approve'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
  });
});
