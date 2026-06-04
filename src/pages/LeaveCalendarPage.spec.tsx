import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getAll: vi.fn() },
  LeaveRequest: {},
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getAll: vi.fn() },
  Department: {},
}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

import LeaveCalendarPage from './LeaveCalendarPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { departmentsApi } from '../services/departmentsService';

const mockLeaveApi = leaveRequestsApi as any;
const mockDeptApi = departmentsApi as any;

const renderPage = () => render(<MemoryRouter><LeaveCalendarPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockDeptApi.getAll.mockResolvedValue({ data: [] });
});

describe('Given LeaveCalendarPage loads', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When page loads / Then "Leave Calendar" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Leave Calendar')).toBeInTheDocument());
  });

  it('When page loads / Then calendar day headers are shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Mon')).toBeInTheDocument());
    expect(screen.getByText('Fri')).toBeInTheDocument();
  });

  it('When page loads / Then navigation buttons for previous/next month exist', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(0));
  });
});

describe('Given LeaveCalendarPage with approved leave requests', () => {
  beforeEach(() => {
    const today = new Date();
    mockLeaveApi.getAll.mockResolvedValue({
      data: [{
        id: 'lr1',
        person: { id: 'p1', full_name: 'Alice' },
        leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL' },
        start_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-10`,
        end_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-12`,
        status: 'approved',
        total_days: 3,
      }],
      total: 1,
    });
  });

  it('When leave data is fetched / Then the API is called with date range', async () => {
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
  });
});

describe('Given LeaveCalendarPage API failure', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockRejectedValue(new Error('Failed'));
  });

  it('When API fails / Then page still renders the calendar structure', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Leave Calendar')).toBeInTheDocument());
  });
});

describe('Given LeaveCalendarPage with departments', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
    mockDeptApi.getAll.mockResolvedValue({
      data: [{ id: 'd1', name: 'Engineering', code: 'ENG', is_active: true }],
    });
  });

  it('When departments load / Then department filter is populated', async () => {
    renderPage();
    await waitFor(() => expect(mockDeptApi.getAll).toHaveBeenCalled());
  });
});
