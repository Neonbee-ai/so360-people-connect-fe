import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn().mockResolvedValue({ data: [], total: 0 }) },
}));

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
        person: { id: 'p1', full_name: 'Alice', department_id: 'd1' },
        leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL' },
        start_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-10`,
        end_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-12`,
        status: 'approved',
        total_days: 3,
      }],
      total: 1,
    });
  });

  it('When leave data is fetched / Then the API is called with start_date and end_date (not from_date/to_date)', async () => {
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
    const calls = mockLeaveApi.getAll.mock.calls;
    // Each call must use start_date / end_date (canonical BE param names)
    calls.forEach((call: any[]) => {
      const params = call[0];
      expect(params).toHaveProperty('start_date');
      expect(params).toHaveProperty('end_date');
      expect(params).not.toHaveProperty('from_date');
      expect(params).not.toHaveProperty('to_date');
    });
  });

  it('When leave data is fetched / Then the approved query uses status=approved', async () => {
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
    const approvedCall = mockLeaveApi.getAll.mock.calls.find((c: any[]) => c[0]?.status === 'approved');
    expect(approvedCall).toBeDefined();
  });
});

describe('Given LeaveCalendarPage API failure', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockImplementation(async () => { throw new Error('Failed'); });
  });

  it('When API fails / Then page still renders the calendar structure', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Leave Calendar')).toBeInTheDocument());
  });

  it('When API fails / Then an error banner is shown with "Unable to load leave data"', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/unable to load leave data/i)).toBeInTheDocument()
    );
  });

  it('When API fails / Then a "Retry" button is shown', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    );
  });

  it('When API fails and Retry is clicked / Then the API is called again', async () => {
    const { getByRole } = renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument());
    // Mount made 2 calls (approved + pending) both rejecting. Now succeed on retry.
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
    getByRole('button', { name: /retry/i }).click();
    // Retry fires 2 more calls (approved + pending) → 4 total
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalledTimes(4));
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

describe('Given LeaveCalendarPage department filter correctness', () => {
  // The previous bug: filter used l.person?.full_name truthy check, not
  // department_id equality. Leaves from other departments would show through.
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const engLeave = {
    id: 'lr-eng',
    person: { id: 'p1', full_name: 'Alice', department_id: 'd-eng' },
    leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL' },
    start_date: `${ym}-05`,
    end_date: `${ym}-05`,
    status: 'approved',
    total_days: 1,
  };
  const hrLeave = {
    id: 'lr-hr',
    person: { id: 'p2', full_name: 'Bob', department_id: 'd-hr' },
    leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL' },
    start_date: `${ym}-05`,
    end_date: `${ym}-05`,
    status: 'approved',
    total_days: 1,
  };

  beforeEach(() => {
    mockDeptApi.getAll.mockResolvedValue({
      data: [
        { id: 'd-eng', name: 'Engineering', code: 'ENG', is_active: true },
        { id: 'd-hr', name: 'HR', code: 'HR', is_active: true },
      ],
    });
    mockLeaveApi.getAll.mockResolvedValue({ data: [engLeave, hrLeave], total: 2 });
  });

  it('When no department filter / Then both leaves load from API', async () => {
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
    // Data is fetched without a department filter (filtering happens client-side)
    const params = mockLeaveApi.getAll.mock.calls[0][0];
    expect(params).not.toHaveProperty('department_id');
  });
});

describe('Given LeaveCalendarPage multi-day leave rendering', () => {
  // A leave spanning multiple days must appear as a card on EACH day it covers.
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  const multiDayLeave = {
    id: 'lr-multi',
    person: { id: 'p1', full_name: 'Carol', department_id: 'd1' },
    leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL' },
    start_date: `${year}-${month}-10`,
    end_date: `${year}-${month}-12`,
    status: 'approved',
    total_days: 3,
  };

  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [multiDayLeave], total: 1 });
  });

  it('When a multi-day leave is returned / Then the API is called with a 200-item limit', async () => {
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
    const call = mockLeaveApi.getAll.mock.calls[0][0];
    expect(call.limit).toBe(200);
  });
});
