import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    submit: vi.fn(),
    delete: vi.fn(),
    getBalances: vi.fn(),
  },
  LeaveRequest: {},
  CreateLeaveRequestPayload: {},
}));

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
}));

vi.mock('../hooks/useShellContext', () => ({
  usePeopleContext: () => ({ orgId: 'o1', tenantId: 't1', userId: 'u1' }),
}));

import LeaveRequestsPage from './LeaveRequestsPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { leaveTypesApi } from '../services/leaveTypesService';

const mockLeaveApi = leaveRequestsApi as any;
const mockTypesApi = leaveTypesApi as any;

const renderPage = () => render(<MemoryRouter><LeaveRequestsPage /></MemoryRouter>);

const mockRequest = {
  id: 'lr1',
  person: { id: 'p1', full_name: 'Alice', email: 'alice@test.com' },
  leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL', color: '#10B981' },
  start_date: '2024-07-01',
  end_date: '2024-07-05',
  total_days: 5,
  status: 'draft',
  reason: 'Family vacation',
  created_at: '2024-06-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockTypesApi.getAll.mockResolvedValue({ data: [] });
  mockLeaveApi.getBalances.mockResolvedValue({ data: [] });
});

describe('Given LeaveRequestsPage loads with requests', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [mockRequest], total: 1 });
  });

  it('When page loads / Then "Leave Requests" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Leave Requests')).toBeInTheDocument());
  });

  it('When requests are fetched / Then leave type name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
  });

  it('When requests are fetched / Then the status badge is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Draft')).toBeInTheDocument());
  });
});

describe('Given LeaveRequestsPage with no requests', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no leave requests exist / Then empty state is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No leave requests/i)).toBeInTheDocument());
  });
});

describe('Given LeaveRequestsPage status filter', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [mockRequest], total: 1 });
  });

  it('When status filter changes / Then API is called with new status', async () => {
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'approved' } });
    await waitFor(() =>
      expect(mockLeaveApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }))
    );
  });
});

describe('Given LeaveRequestsPage API failure', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockRejectedValue(new Error('Server error'));
  });

  it('When API fails / Then error toast is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load leave requests')).toBeInTheDocument());
  });
});
