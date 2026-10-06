import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getById: vi.fn(), getBalances: vi.fn(), approve: vi.fn(), reject: vi.fn() },
  LeaveRequest: {},
  LeaveBalance: {},
}));

let canApprove = true;
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, hasPermission: () => canApprove }),
}));
vi.mock('@so360/design-system', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  getErrorMessage: (_e: unknown, f: string) => f,
}));
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({ formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '' }),
}));

import LeaveRequestDetailPage from '../pages/LeaveRequestDetailPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';

const api = leaveRequestsApi as any;
const base = {
  id: 'lr1', person_id: 'p1', leave_type_id: 'lt1', start_date: '2026-10-10', end_date: '2026-10-12',
  total_days: 3, status: 'pending', person: { id: 'p1', full_name: 'Alice Smith' }, leave_type: { id: 'lt1', name: 'Annual Leave' }, approvals: [],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/leaves/requests/lr1']}>
    <Routes><Route path="/leaves/requests/:id" element={<LeaveRequestDetailPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.resetAllMocks();
  canApprove = true;
  api.getBalances.mockResolvedValue({ data: [] });
});

describe('LeaveRequestDetailPage', () => {
  describe('Given a pending request and an approver', () => {
    it('shows the request with Approve and Reject actions', async () => {
      api.getById.mockResolvedValue(base);
      renderPage();
      expect(await screen.findByText('Annual Leave')).toBeTruthy();
      expect(screen.getByText('Approve')).toBeTruthy();
      expect(screen.getByText('Reject')).toBeTruthy();
    });

    it('requires a reason before rejecting', async () => {
      api.getById.mockResolvedValue(base);
      api.reject.mockResolvedValue({});
      renderPage();
      fireEvent.click(await screen.findByText('Reject'));
      const confirm = screen.getByText('Confirm Reject') as HTMLButtonElement;
      expect(confirm.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/Rejection Reason/), { target: { value: 'Team at capacity' } });
      fireEvent.click(confirm);
      await waitFor(() => expect(api.reject).toHaveBeenCalledWith('lr1', 'Team at capacity'));
    });

    it('approves in one tap', async () => {
      api.getById.mockResolvedValue(base);
      api.approve.mockResolvedValue({ fully_approved: true });
      renderPage();
      fireEvent.click(await screen.findByText('Approve'));
      await waitFor(() => expect(api.approve).toHaveBeenCalledWith('lr1'));
    });
  });

  describe('Given a requester without approve permission', () => {
    it('renders read-only with no actions', async () => {
      canApprove = false;
      api.getById.mockResolvedValue(base);
      renderPage();
      expect(await screen.findByText('Annual Leave')).toBeTruthy();
      expect(screen.queryByText('Approve')).toBeNull();
      expect(screen.queryByText('Reject')).toBeNull();
    });
  });

  describe('Given a request that is already decided', () => {
    it('hides the actions', async () => {
      api.getById.mockResolvedValue({ ...base, status: 'approved' });
      renderPage();
      expect(await screen.findByText('Annual Leave')).toBeTruthy();
      expect(screen.queryByText('Approve')).toBeNull();
    });
  });

  describe('Given an unknown id', () => {
    it('shows the not-found state', async () => {
      api.getById.mockRejectedValue(new Error('404'));
      renderPage();
      expect(await screen.findByText('Leave request not found')).toBeTruthy();
    });
  });
});
