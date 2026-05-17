import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getAll: vi.fn(), create: vi.fn(), submit: vi.fn(), getBalances: vi.fn() },
  LeaveRequest: {},
  CreateLeaveRequestPayload: {},
  LeaveBalance: {},
}));

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn() },
  LeaveType: {},
}));

vi.mock('../services/apiClient', () => ({
  apiContext: { getUserId: () => 'u1' },
}));


vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
}));

import LeaveRequestsPage from '../pages/LeaveRequestsPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';

const mockApi = leaveRequestsApi as any;

const renderPage = () => render(<MemoryRouter><LeaveRequestsPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('LeaveRequestsPage', () => {
  describe('Given leave requests exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          {
            id: 'lr1', person_id: 'p1', leave_type_id: 'lt1', start_date: '2025-06-01',
            end_date: '2025-06-03', is_half_day_start: false, is_half_day_end: true,
            total_days: 2.5, status: 'pending', submitted_at: '2025-05-28',
            person: { id: 'p1', full_name: 'Alice', avatar_url: null },
            leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL', color: '#10b981' },
          },
        ],
      });
    });

    it('When the page loads / Then it renders the requests table', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      expect(screen.getByText('Annual Leave')).toBeInTheDocument();
      expect(screen.getByText('2.5')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows tabs for My and Team requests', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('My Requests')).toBeInTheDocument());
      expect(screen.getByText('Team Requests')).toBeInTheDocument();
    });

    it('When Request Leave is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      fireEvent.click(screen.getAllByText('Request Leave')[0]);
      await waitFor(() => expect(screen.getByText('Leave Type *')).toBeInTheDocument());
    });
  });

  describe('Given no leave requests exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No leave requests found')).toBeInTheDocument());
    });
  });
});
