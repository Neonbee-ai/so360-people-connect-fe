/**
 * BDD specs for <AttendanceRegisterPage>.
 *
 * Phase 1 daily attendance register: KPI cards from the summary endpoint, one
 * row per person for the selected date, per-row quick-mark actions (POST
 * /attendance, upsert semantics) and an Edit modal that requires a reason and
 * falls back to POST when nothing has been recorded yet for that person/date
 * (attendance_id === null), otherwise PATCHes the existing record.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import React from 'react';

// The KPI row permanently renders labels "Present" / "Absent" / "Half Day" —
// the same display text a matching per-row status badge would show. Every
// assertion on those strings below is scoped to a specific table row via
// `within(...)` so it can't accidentally match the KPI card instead.

vi.mock('../services/attendanceService', () => ({
  attendanceApi: {
    getRegister: vi.fn(),
    getSummary: vi.fn(),
    mark: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getHistory: vi.fn(),
  },
}));

import AttendanceRegisterPage from './AttendanceRegisterPage';
import { attendanceApi } from '../services/attendanceService';

const mockAttendanceApi = attendanceApi as any;

const aliceUnmarked = {
  person_id: 'p1',
  person_name: 'Alice',
  department_id: 'd1',
  department_name: 'Engineering',
  designation: 'Engineer',
  attendance_id: null,
  status: null,
  check_in: null,
  check_out: null,
  notes: null,
};

const bobPresent = {
  person_id: 'p2',
  person_name: 'Bob',
  department_id: 'd1',
  department_name: 'Engineering',
  designation: 'Senior Engineer',
  attendance_id: 'a2',
  status: 'present',
  check_in: '09:00',
  check_out: '18:00',
  notes: null,
};

const summaryFixture = { total_employees: 2, present: 1, absent: 0, on_leave: 0, half_day: 0, remote: 0 };

const renderPage = () => render(<AttendanceRegisterPage />);

beforeEach(() => {
  vi.resetAllMocks();
  mockAttendanceApi.getSummary.mockResolvedValue(summaryFixture);
});

describe('Given AttendanceRegisterPage loads the register for the default (today) date', () => {
  beforeEach(() => {
    mockAttendanceApi.getRegister.mockResolvedValue({ data: [aliceUnmarked, bobPresent], total: 2, page: 1, limit: 20 });
  });

  it('When the register loads / Then one row renders per person', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('When a row has status=null and attendance_id=null / Then it shows a neutral "Not Marked" badge, not a false Absent', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    const aliceRow = screen.getByText('Alice').closest('tr')!;
    expect(within(aliceRow).getByText('Not Marked')).toBeInTheDocument();
    expect(within(aliceRow).queryByText('Absent')).not.toBeInTheDocument();
  });

  it('When a row already has a recorded status / Then it shows the color-coded status badge for that status', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    const bobRow = screen.getByText('Bob').closest('tr')!;
    expect(within(bobRow).getByText('Present')).toBeInTheDocument();
  });
});

describe('Given AttendanceRegisterPage KPI cards', () => {
  beforeEach(() => {
    // Only an unmarked row here — keeps the "Present" text unique to the KPI
    // card label (a row with status='present' would also render a "Present"
    // status badge and make the assertion ambiguous).
    mockAttendanceApi.getRegister.mockResolvedValue({ data: [aliceUnmarked], total: 1, page: 1, limit: 20 });
    mockAttendanceApi.getSummary.mockResolvedValue(summaryFixture);
  });

  it('When the summary loads / Then the KPI cards render the summary endpoint values', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Total Employees')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument(); // Total Employees
    expect(screen.getByText('1')).toBeInTheDocument(); // Present
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3); // Absent, On Leave, Half Day, Remote
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.getByText('Absent')).toBeInTheDocument();
    expect(screen.getByText('On Leave')).toBeInTheDocument();
    expect(screen.getByText('Half Day')).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();
  });
});

describe('Given a quick-mark action is clicked for an unmarked person', () => {
  beforeEach(() => {
    mockAttendanceApi.getRegister.mockResolvedValue({ data: [aliceUnmarked], total: 1, page: 1, limit: 20 });
  });

  it('When "Mark Present" is clicked / Then POST /attendance fires with the right payload and the row updates', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());

    // Pin the date so the payload assertion is deterministic.
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-20' } });
    await waitFor(() => expect(mockAttendanceApi.getRegister).toHaveBeenCalledWith({ date: '2026-07-20' }));

    mockAttendanceApi.mark.mockResolvedValue({
      id: 'a1',
      person_id: 'p1',
      attendance_date: '2026-07-20',
      status: 'present',
      check_in: null,
      check_out: null,
      notes: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mark Present' }));

    await waitFor(() =>
      expect(mockAttendanceApi.mark).toHaveBeenCalledWith({ person_id: 'p1', attendance_date: '2026-07-20', status: 'present' }),
    );
    const aliceRow = screen.getByText('Alice').closest('tr')!;
    await waitFor(() => expect(within(aliceRow).getByText('Present')).toBeInTheDocument());
    expect(within(aliceRow).queryByText('Not Marked')).not.toBeInTheDocument();
  });

  it('When the quick-mark call fails / Then the optimistic update is reverted and an error toast is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());

    mockAttendanceApi.mark.mockRejectedValue(new Error('Server error'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Absent' }));

    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
    const aliceRow = screen.getByText('Alice').closest('tr')!;
    expect(within(aliceRow).getByText('Not Marked')).toBeInTheDocument();
  });
});

describe('Given the Edit Attendance modal is opened', () => {
  beforeEach(() => {
    mockAttendanceApi.getRegister.mockResolvedValue({ data: [aliceUnmarked, bobPresent], total: 2, page: 1, limit: 20 });
  });

  it('When submitted without a reason / Then it is blocked client-side and no API call is made', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit attendance for Bob' }));
    await waitFor(() => expect(screen.getByText('Edit Attendance — Bob')).toBeInTheDocument());

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeDisabled();

    // Directly submit the form to exercise the client-side guard regardless
    // of the button's disabled state (mirrors the server's required-reason rule).
    fireEvent.submit(saveButton.closest('form')!);

    expect(await screen.findByText('A reason is required to save this change.')).toBeInTheDocument();
    expect(mockAttendanceApi.update).not.toHaveBeenCalled();
    expect(mockAttendanceApi.mark).not.toHaveBeenCalled();
  });

  it('When the row has an attendance_id / Then submitting with a reason calls PATCH /attendance/:id', async () => {
    mockAttendanceApi.update.mockResolvedValue({ id: 'a2', person_id: 'p2', attendance_date: '2026-07-20', status: 'half_day', check_in: '09:00', check_out: '18:00', notes: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit attendance for Bob' }));
    await waitFor(() => expect(screen.getByText('Edit Attendance — Bob')).toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'half_day' } });
    fireEvent.change(screen.getByPlaceholderText('Why is this change being made?'), { target: { value: 'Left early for a doctor appointment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(mockAttendanceApi.update).toHaveBeenCalledWith('a2', expect.objectContaining({
        status: 'half_day',
        reason: 'Left early for a doctor appointment',
      })),
    );
    expect(mockAttendanceApi.mark).not.toHaveBeenCalled();
  });

  it('When the row has no attendance_id yet / Then submitting with a reason calls POST /attendance instead', async () => {
    mockAttendanceApi.mark.mockResolvedValue({ id: 'a1', person_id: 'p1', attendance_date: '2026-07-20', status: 'present', check_in: null, check_out: null, notes: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-20' } });
    await waitFor(() => expect(mockAttendanceApi.getRegister).toHaveBeenCalledWith({ date: '2026-07-20' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit attendance for Alice' }));
    await waitFor(() => expect(screen.getByText('Edit Attendance — Alice')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Why is this change being made?'), { target: { value: 'Manual correction' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(mockAttendanceApi.mark).toHaveBeenCalledWith(expect.objectContaining({
        person_id: 'p1',
        attendance_date: '2026-07-20',
      })),
    );
    expect(mockAttendanceApi.update).not.toHaveBeenCalled();
  });
});

describe('Given AttendanceRegisterPage with no employees for the date', () => {
  beforeEach(() => {
    mockAttendanceApi.getRegister.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('When the register is empty / Then the empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No employees found for this date/i)).toBeInTheDocument());
  });
});

describe('Given AttendanceRegisterPage register fetch fails', () => {
  beforeEach(() => {
    mockAttendanceApi.getRegister.mockImplementation(async () => { throw new Error('Network error'); });
  });

  it('When the register fetch fails / Then an error toast is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load attendance register')).toBeInTheDocument());
  });
});
