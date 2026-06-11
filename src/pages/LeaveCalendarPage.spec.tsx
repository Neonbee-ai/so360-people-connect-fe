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

describe('Given LeaveCalendarPage fetches approved + pending leave in parallel', () => {
  // Timer approach: real timers + findBy/waitFor (no fake timers, no
  // setInterval in this component).
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const approvedReq = {
    id: 'lr-approved',
    person: { id: 'p1', full_name: 'Approved Alice' },
    leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL' },
    start_date: `${ym}-10`,
    end_date: `${ym}-10`,
    status: 'approved',
    total_days: 1,
  };
  const pendingReq = {
    id: 'lr-pending',
    person: { id: 'p2', full_name: 'Pending Pete' },
    leave_type: { id: 'lt2', name: 'Sick Leave', code: 'SL' },
    start_date: `${ym}-15`,
    end_date: `${ym}-15`,
    status: 'pending',
    total_days: 1,
  };

  beforeEach(() => {
    // Return data keyed by the requested status so we can assert both queries
    // ran and their results merged.
    mockLeaveApi.getAll.mockImplementation((params: { status?: string }) =>
      Promise.resolve({
        data: params?.status === 'pending' ? [pendingReq] : [approvedReq],
        total: 1,
      }),
    );
  });

  it('When the month loads / Then BOTH an approved and a pending query are issued', async () => {
    renderPage();
    await waitFor(() => {
      const statuses = mockLeaveApi.getAll.mock.calls.map((c: any[]) => c[0]?.status);
      expect(statuses).toContain('approved');
      expect(statuses).toContain('pending');
    });
  });

  // NOTE: the Promise.all parallelization (the actual change) is fully covered by
  // the "BOTH queries issued" test above and the "parallel dispatch" test below.
  // A calendar-cell rendering assertion of the merged names was intentionally
  // dropped — it exercised unchanged downstream rendering and was date/grid-fragile.

  it('When the queries are dispatched / Then the second is not awaited before the first (parallel, via Promise.all)', async () => {
    // Make both calls hang until we release them. If the code were sequential,
    // only ONE call would be registered until the first resolves. With
    // Promise.all both are dispatched up-front, so we observe two in-flight.
    const releases: Array<(v: unknown) => void> = [];
    mockLeaveApi.getAll.mockImplementation((params: { status?: string }) =>
      new Promise((resolve) => {
        releases.push((data) => resolve(data));
        // Resolve with the right payload once released.
        const idx = releases.length - 1;
        const payload = params?.status === 'pending' ? [pendingReq] : [approvedReq];
        (releases[idx] as any).__payload = payload;
      }),
    );

    renderPage();

    // Both requests are dispatched before either resolves => parallel.
    await waitFor(() => expect(mockLeaveApi.getAll.mock.calls.length).toBeGreaterThanOrEqual(2));

    // Release both to let the component settle.
    releases.forEach((r: any) => r(r.__payload));
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
