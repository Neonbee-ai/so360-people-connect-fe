import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../services/attendanceService', () => ({
  attendanceApi: { getRegister: vi.fn(), getSummary: vi.fn(), mark: vi.fn(), update: vi.fn(), delete: vi.fn(), getHistory: vi.fn() },
  attendanceCorrectionsApi: { createMine: vi.fn(), listMine: vi.fn(), list: vi.fn(), approve: vi.fn(), reject: vi.fn() },
}));

import AttendanceRegisterPage from './AttendanceRegisterPage';
import { attendanceApi, attendanceCorrectionsApi } from '../services/attendanceService';
import { toast } from '@so360/design-system';

const api = attendanceApi as any;
const corrections = attendanceCorrectionsApi as any;

const alice = { person_id: 'p1', person_name: 'Alice', department_name: 'Engineering', designation: 'Engineer', attendance_id: null, status: null, check_in: null, check_out: null, notes: null };
const correction = { id: 'c1', person_id: 'p1', person_name: 'Alice', designation: 'Engineer', attendance_date: '2026-08-10', requested_check_in: '09:00', requested_check_out: '18:00', requested_status: 'present', reason: 'Forgot to punch in', status: 'pending', review_note: null };

beforeEach(() => {
  vi.resetAllMocks();
  api.getRegister.mockResolvedValue({ data: [alice] });
  api.getSummary.mockResolvedValue({ total_employees: 1, present: 0, absent: 0, on_leave: 0, half_day: 0, remote: 0 });
  corrections.list.mockResolvedValue({ data: [], total: 0 });
});

describe('AttendanceRegisterPage (Comb)', () => {
  it('Given the page / When it loads / Then title, tabs, date and the employee row show', async () => {
    render(<AttendanceRegisterPage />);
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Attendance Register')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByText('Not Marked')).toBeInTheDocument();
  });

  it('Given the register is pending / When it renders / Then a loading status shows', () => {
    api.getRegister.mockReturnValue(new Promise(() => {}));
    render(<AttendanceRegisterPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('Given no employees / When it loads / Then the empty state shows', async () => {
    api.getRegister.mockResolvedValue({ data: [] });
    render(<AttendanceRegisterPage />);
    expect(await screen.findByText('No employees found for this date')).toBeInTheDocument();
  });

  it('Given an unmarked row / When Mark Present is clicked / Then the same mark API is called', async () => {
    api.mark.mockResolvedValue({ id: 'a1', status: 'present', check_in: null, check_out: null, notes: null });
    render(<AttendanceRegisterPage />);
    await screen.findByText('Alice');
    fireEvent.click(screen.getByRole('button', { name: 'Mark Present' }));
    await waitFor(() => expect(api.mark).toHaveBeenCalledWith(expect.objectContaining({ person_id: 'p1', status: 'present' })));
  });

  it('Given the mark call fails / When Mark Absent is clicked / Then an error toast shows', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.mark.mockRejectedValue(new Error('Server error'));
    render(<AttendanceRegisterPage />);
    await screen.findByText('Alice');
    fireEvent.click(screen.getByRole('button', { name: 'Mark Absent' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Server error'));
  });

  it('Given the edit modal / When saved without a reason / Then the reason error shows and no API call is made', async () => {
    render(<AttendanceRegisterPage />);
    await screen.findByText('Alice');
    fireEvent.click(screen.getByRole('button', { name: 'Edit attendance for Alice' }));
    const save = await screen.findByRole('button', { name: 'Save Changes' });
    expect(save).toBeDisabled();
    fireEvent.submit(save.closest('form')!);
    expect(await screen.findByText('A reason is required to save this change.')).toBeInTheDocument();
    expect(api.mark).not.toHaveBeenCalled();
  });

  it('Given the Corrections tab / When a pending request is approved / Then the approve API is called', async () => {
    corrections.list.mockResolvedValue({ data: [correction], total: 1 });
    corrections.approve.mockResolvedValue({});
    render(<AttendanceRegisterPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Corrections' }));
    fireEvent.click(await screen.findByRole('button', { name: /approve correction for alice/i }));
    await waitFor(() => expect(corrections.approve).toHaveBeenCalledWith('c1'));
  });

  it('Given the Corrections tab is empty / When opened / Then the empty state shows', async () => {
    render(<AttendanceRegisterPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Corrections' }));
    expect(await screen.findByText('No correction requests')).toBeInTheDocument();
  });
});
