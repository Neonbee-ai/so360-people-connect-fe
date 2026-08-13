import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

/*
 * Month navigation, filter persistence, and date legibility.
 *
 * Navigating months already refetched, but the outgoing month's entries stayed
 * painted until the new response landed — indistinguishable from leave that
 * belongs to the month now on screen.
 */
const leaveOn = (dateStr: string, name: string, deptId?: string) => ({
  id: `lr-${name}-${dateStr}`,
  person: { id: `p-${name}`, full_name: `${name} Person`, department_id: deptId },
  leave_type: { id: 'lt1', name: 'Annual Leave' },
  start_date: dateStr,
  end_date: dateStr,
  status: 'approved',
  total_days: 1,
});

// Derived from the real clock so the specs stay correct on any run date.
const NOW = new Date();
// Built from LOCAL calendar parts on purpose: the page keys its fetch and its
// header off the local year/month, and going through toISOString() here would
// bake the very UTC shift these specs exist to prevent.
const monthLabel = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)));
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const THIS_MONTH = monthLabel(NOW);
const PREV = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1);
const PREV_MONTH = monthLabel(PREV);
const PREV_FIRST = iso(new Date(PREV.getFullYear(), PREV.getMonth(), 1));
const PREV_LAST = iso(new Date(PREV.getFullYear(), PREV.getMonth() + 1, 0));
const THIS_15TH = iso(new Date(NOW.getFullYear(), NOW.getMonth(), 15));
const PREV_15TH = iso(new Date(PREV.getFullYear(), PREV.getMonth(), 15));

const prevButton = () => screen.getByText(THIS_MONTH).previousElementSibling as Element;

describe('Given the Leave Calendar is navigated between months', () => {
  beforeEach(() => {
    mockDeptApi.getAll.mockResolvedValue({
      data: [
        { id: 'd1', name: 'Engineering' },
        { id: 'd2', name: 'Marketing' },
      ],
    });
  });

  it('When the previous month is opened / Then leave is refetched for that month range', async () => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
    mockLeaveApi.getAll.mockClear();

    fireEvent.click(prevButton());

    await waitFor(() =>
      expect(mockLeaveApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ start_date: PREV_FIRST, end_date: PREV_LAST }),
      ),
    );
  });

  it('When the month changes / Then the previous month entries are cleared before the new data arrives', async () => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [leaveOn(THIS_15TH, 'Stale')], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Stale').length).toBeGreaterThan(0));

    // The next fetch never resolves — anything still on screen is stale paint.
    mockLeaveApi.getAll.mockImplementation(() => new Promise(() => {}));
    fireEvent.click(prevButton());

    await waitFor(() => expect(screen.queryByText('Stale')).not.toBeInTheDocument());
  });

  it('When a department is selected and the month changes / Then the filter is still applied', async () => {
    mockLeaveApi.getAll.mockResolvedValue({
      data: [leaveOn(PREV_15TH, 'Eng', 'd1'), leaveOn(PREV_15TH, 'Mkt', 'd2')],
      total: 2,
    });
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());

    fireEvent.change(screen.getByDisplayValue('All Departments'), { target: { value: 'd1' } });
    fireEvent.click(prevButton());

    await waitFor(() => expect(screen.getByText(PREV_MONTH)).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('Eng').length).toBeGreaterThan(0));
    expect(screen.queryByText('Mkt')).not.toBeInTheDocument();
    // The select keeps the chosen department rather than resetting on nav.
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('d1');
  });

  it('When the grid renders / Then date numbers use the larger type scale', async () => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText(THIS_MONTH)).toBeInTheDocument());

    const dateCell = screen.getByText('15');
    expect(dateCell.className).toContain('text-sm');
    expect(dateCell.className).not.toContain('text-xs');
  });

  it('When months are switched faster than the API responds / Then a superseded response never repaints the grid', async () => {
    // Hold the previous-month response open, then come back to this month and
    // let it answer first. Releasing the stale response last must not repaint.
    let releaseStale: (v: unknown) => void = () => {};
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());

    mockLeaveApi.getAll.mockImplementation(
      () => new Promise((resolve) => { releaseStale = resolve; }),
    );
    fireEvent.click(prevButton()); // → previous month, response withheld

    mockLeaveApi.getAll.mockResolvedValue({ data: [leaveOn(THIS_15TH, 'Current')], total: 1 });
    fireEvent.click(screen.getByText(PREV_MONTH).nextElementSibling as Element); // → back to this month
    await waitFor(() => expect(screen.getAllByText('Current').length).toBeGreaterThan(0));

    releaseStale({ data: [leaveOn(PREV_15TH, 'Superseded')], total: 1 });

    await waitFor(() => expect(screen.getByText(THIS_MONTH)).toBeInTheDocument());
    expect(screen.queryByText('Superseded')).not.toBeInTheDocument();
    expect(screen.getAllByText('Current').length).toBeGreaterThan(0);
  });
});

describe('Given a department is selected on the Leave Calendar', () => {
  const withDept = (deptId?: string, deptName?: string) => ({
    id: `lr-${deptId ?? deptName ?? 'none'}`,
    person: {
      id: 'p1',
      full_name: 'Dhanooj Person',
      department_id: deptId,
      department: deptName,
    },
    leave_type: { id: 'lt1', name: 'Annual Leave' },
    start_date: THIS_15TH,
    end_date: THIS_15TH,
    status: 'approved',
    total_days: 1,
  });

  beforeEach(() => {
    mockDeptApi.getAll.mockResolvedValue({
      data: [
        { id: 'd-eng', name: 'Engineering A' },
        { id: 'd-qa', name: 'QA Dpt', parent_id: 'd-eng' },
        { id: 'd-sales', name: 'Sales' },
      ],
    });
  });

  const selectDept = (value: string) =>
    fireEvent.change(screen.getByRole('combobox'), { target: { value } });

  it('When the person sits in a SUB-department / Then their leave still shows under the parent', async () => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [withDept('d-qa')], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Dhanooj').length).toBeGreaterThan(0));

    selectDept('d-eng');

    await waitFor(() => expect(screen.getAllByText('Dhanooj').length).toBeGreaterThan(0));
  });

  it('When the person carries only the legacy department TEXT / Then the name matches that department', async () => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [withDept(undefined, 'Sales')], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Dhanooj').length).toBeGreaterThan(0));

    selectDept('d-sales');

    await waitFor(() => expect(screen.getAllByText('Dhanooj').length).toBeGreaterThan(0));
  });

  it('When the department has no leave this month / Then an explicit empty state names the department', async () => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [withDept('d-sales', 'Sales')], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Dhanooj').length).toBeGreaterThan(0));

    selectDept('d-eng');

    await waitFor(() =>
      expect(screen.getByText(/No leave records for Engineering A/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText('Dhanooj')).not.toBeInTheDocument();
  });

  it('When no department is selected and the month is empty / Then a plain empty state is shown', async () => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(new RegExp(`No leave records in ${THIS_MONTH}`, 'i'))).toBeInTheDocument(),
    );
  });
});

describe('Given the calendar header is rendered in a positive-offset timezone', () => {
  // Local midnight on the 1st is the PREVIOUS day in UTC, so formatting the raw
  // Date object labelled July as "June" for anyone east of Greenwich.
  beforeEach(() => {
    mockDeptApi.getAll.mockResolvedValue({ data: [] });
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When a month is navigated to / Then the header names that month, not the one before it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(THIS_MONTH)).toBeInTheDocument());

    fireEvent.click(prevButton());

    await waitFor(() => expect(screen.getByText(PREV_MONTH)).toBeInTheDocument());
    expect(PREV_MONTH).toBe(
      new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(PREV.getFullYear(), PREV.getMonth(), 1))),
    );
  });

  it('When a month is navigated to / Then the fetch range is that month\'s local first and last day', async () => {
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
    mockLeaveApi.getAll.mockClear();

    fireEvent.click(prevButton());

    await waitFor(() => {
      const params = mockLeaveApi.getAll.mock.calls[0][0];
      expect(params.start_date).toMatch(/-01$/);
      expect(params.start_date.slice(0, 7)).toBe(
        `${PREV.getFullYear()}-${String(PREV.getMonth() + 1).padStart(2, '0')}`,
      );
      expect(params.end_date.slice(0, 7)).toBe(params.start_date.slice(0, 7));
    });
  });
});
