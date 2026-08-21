import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * MyTimePage — BDD specs.
 *
 * The first clock-in surface the web app has ever had: the backend endpoints
 * and the `job_sessions.clock` grant have both existed since Crew P1, with no
 * UI referencing them. The specs pin that every action goes through the
 * self-scoped /me/session client, which never names a person.
 */

vi.mock('../../services/meService', () => ({
    meService: {
        myOpenSession: vi.fn(),
        myAttendance: vi.fn(),
        myAllocations: vi.fn(),
        clockIn: vi.fn(),
        clockOut: vi.fn(),
        startBreak: vi.fn(),
        endBreak: vi.fn(),
    },
}));

vi.mock('@so360/design-system', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../services/attendanceService', () => ({
    attendanceCorrectionsApi: {
        createMine: vi.fn(),
        listMine: vi.fn(),
        list: vi.fn(),
        approve: vi.fn(),
        reject: vi.fn(),
    },
}));

import MyTimePage from './MyTimePage';
import { meService } from '../../services/meService';
import { attendanceCorrectionsApi } from '../../services/attendanceService';
import { toast } from '@so360/design-system';

const openSession = {
    id: 's1',
    person_id: 'p1',
    entity_type: 'project_task',
    entity_id: 'e1',
    entity_name: 'Fit-out — Level 3',
    started_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    break_started_at: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    (meService.myOpenSession as any).mockResolvedValue({ session: null });
    (meService.myAttendance as any).mockResolvedValue({ data: [] });
    (meService.myAllocations as any).mockResolvedValue({ data: [] });
    (meService.clockIn as any).mockResolvedValue({});
    (meService.clockOut as any).mockResolvedValue({});
    (meService.startBreak as any).mockResolvedValue({});
    (meService.endBreak as any).mockResolvedValue({});
    (attendanceCorrectionsApi.listMine as any).mockResolvedValue({ data: [], total: 0 });
    (attendanceCorrectionsApi.createMine as any).mockResolvedValue({ id: 'c-new', status: 'pending' });
});

describe('Given an employee who is not clocked in', () => {
    it('When the page loads / Then it says so rather than showing a dead timer', async () => {
        render(<MyTimePage />);

        await waitFor(() =>
            expect(screen.getByText(/not clocked in/i)).toBeInTheDocument(),
        );
        expect(screen.queryByRole('button', { name: /clock out/i })).not.toBeInTheDocument();
    });
});

describe('Given an employee who is clocked in', () => {
    beforeEach(() => {
        (meService.myOpenSession as any).mockResolvedValue({ session: openSession });
    });

    it('When the page loads / Then the job and elapsed time are shown', async () => {
        render(<MyTimePage />);

        await waitFor(() =>
            expect(screen.getByText(/Fit-out — Level 3/)).toBeInTheDocument(),
        );
        expect(screen.getByText(/1h 30m ago/)).toBeInTheDocument();
    });

    it('When they clock out / Then the self-scoped call is used with no person argument', async () => {
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByText(/Clocked in/)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /clock out/i }));

        await waitFor(() => expect(meService.clockOut).toHaveBeenCalled());
        // The whole safety property: the client cannot name a person, so this
        // cannot clock out a colleague.
        expect((meService.clockOut as any).mock.calls[0]).toEqual([]);
    });

    it('When they start a break / Then the break call is made', async () => {
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByText(/Clocked in/)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /take a break/i }));

        await waitFor(() => expect(meService.startBreak).toHaveBeenCalled());
        expect(toast.success).toHaveBeenCalledWith('Break started');
    });

    it('When the action fails / Then the reason is surfaced', async () => {
        (meService.clockOut as any).mockRejectedValue(new Error('No open session'));
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByText(/Clocked in/)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /clock out/i }));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith('No open session'),
        );
    });
});

describe('Given an employee already on a break', () => {
    beforeEach(() => {
        (meService.myOpenSession as any).mockResolvedValue({
            session: { ...openSession, break_started_at: new Date().toISOString() },
        });
    });

    it('When the page loads / Then it offers resume rather than another break', async () => {
        render(<MyTimePage />);

        await waitFor(() => expect(screen.getByText(/On break/)).toBeInTheDocument());
        expect(screen.getByRole('button', { name: /resume work/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /take a break/i })).not.toBeInTheDocument();
    });

    it('When they resume / Then the break is ended', async () => {
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByText(/On break/)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /resume work/i }));

        await waitFor(() => expect(meService.endBreak).toHaveBeenCalled());
    });
});

describe('Given recorded attendance', () => {
    it('When the page loads / Then my own attendance history is listed', async () => {
        (meService.myAttendance as any).mockResolvedValue({
            data: [
                { id: 'a1', attendance_date: '2026-08-19', status: 'present' },
                { id: 'a2', attendance_date: '2026-08-18', status: 'absent' },
            ],
        });

        render(<MyTimePage />);

        await waitFor(() => expect(screen.getByText('2026-08-19')).toBeInTheDocument());
        expect(screen.getByText('absent')).toBeInTheDocument();
    });

    it('When there is none / Then it says so rather than showing an empty box', async () => {
        render(<MyTimePage />);

        await waitFor(() =>
            expect(screen.getByText(/No attendance recorded yet/i)).toBeInTheDocument(),
        );
    });

    it('When the session lookup fails / Then the page still renders as not clocked in', async () => {
        (meService.myOpenSession as any).mockRejectedValue(new Error('down'));

        render(<MyTimePage />);

        await waitFor(() =>
            expect(screen.getByText(/not clocked in/i)).toBeInTheDocument(),
        );
    });
});

describe('Given a session with no job name', () => {
    it('When it renders / Then the status line omits the job rather than showing undefined', async () => {
        (meService.myOpenSession as any).mockResolvedValue({
            session: { ...openSession, entity_name: null },
        });

        render(<MyTimePage />);

        await waitFor(() => expect(screen.getByText(/Clocked in/)).toBeInTheDocument());
        expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    });
});

describe('Given an employee with active work assignments', () => {
    beforeEach(() => {
        (meService.myAllocations as any).mockResolvedValue({
            data: [
                { id: 'al1', entity_type: 'project_task', entity_id: 'e-1',
                  entity_name: 'Fit-out L3', start_date: '2026-08-01', end_date: null,
                  allocation_value: 100, status: 'active' },
            ],
        });
    });

    it('When not clocked in / Then a job picker is offered', async () => {
        render(<MyTimePage />);

        await waitFor(() =>
            expect(screen.getByText(/What are you working on/i)).toBeInTheDocument(),
        );
        expect(screen.getByRole('button', { name: /clock in/i })).toBeInTheDocument();
    });

    it('When no job is chosen / Then Clock in stays disabled', async () => {
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());

        expect(screen.getByRole('button', { name: /clock in/i })).toBeDisabled();
    });

    it('When a job is chosen and clocked in / Then the work unit is sent, never a person', async () => {
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'al1' } });
        fireEvent.click(screen.getByRole('button', { name: /clock in/i }));

        await waitFor(() => expect(meService.clockIn).toHaveBeenCalled());
        const payload = (meService.clockIn as any).mock.calls[0][0];

        expect(payload).toEqual({
            entity_type: 'project_task',
            entity_id: 'e-1',
            entity_name: 'Fit-out L3',
        });
        expect(payload).not.toHaveProperty('person_id');
    });
});

describe('Given an employee with no assignments', () => {
    it('When not clocked in / Then it explains why rather than offering a dead button', async () => {
        // A job session must book time against a work unit; with none there is
        // genuinely nothing to clock in to.
        render(<MyTimePage />);

        await waitFor(() =>
            expect(screen.getByText(/no active work assignments/i)).toBeInTheDocument(),
        );
        expect(screen.queryByRole('button', { name: /clock in/i })).not.toBeInTheDocument();
    });
});

// ===========================================================================
// Attendance corrections (regularization)
// ===========================================================================

describe('Given my correction requests', () => {
    it('When the page loads / Then my requests are listed with their status', async () => {
        (attendanceCorrectionsApi.listMine as any).mockResolvedValue({
            data: [
                {
                    id: 'c1', attendance_date: '2026-08-10',
                    requested_check_in: '09:00', requested_check_out: '18:00',
                    requested_status: 'present', reason: 'Forgot to punch in',
                    status: 'pending', review_note: null,
                },
                {
                    id: 'c2', attendance_date: '2026-08-05',
                    requested_check_in: null, requested_check_out: null,
                    requested_status: 'present', reason: 'Badge failed',
                    status: 'rejected', review_note: 'Register shows leave',
                },
            ],
            total: 2,
        });

        render(<MyTimePage />);

        await waitFor(() => expect(screen.getByText('2026-08-10')).toBeInTheDocument());
        expect(screen.getByText('Forgot to punch in')).toBeInTheDocument();
        expect(screen.getByText('pending')).toBeInTheDocument();
        // Rejection note is surfaced to the employee
        expect(screen.getByText(/Register shows leave/)).toBeInTheDocument();
    });

    it('When there are none / Then it invites a request rather than showing an empty box', async () => {
        render(<MyTimePage />);

        await waitFor(() =>
            expect(screen.getByText(/No correction requests yet/i)).toBeInTheDocument(),
        );
    });
});

describe('Given an employee filing a correction', () => {
    const openForm = async () => {
        render(<MyTimePage />);
        await waitFor(() =>
            expect(screen.getByRole('button', { name: /request correction/i })).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByRole('button', { name: /request correction/i }));
        await waitFor(() => expect(screen.getByLabelText(/reason/i)).toBeInTheDocument());
    };

    it('When the reason is empty / Then submit stays disabled', async () => {
        await openForm();

        expect(screen.getByRole('button', { name: /submit request/i })).toBeDisabled();
    });

    it('When submitted / Then the self-scoped create is called with the fields and NO person id', async () => {
        await openForm();

        fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-08-10' } });
        fireEvent.change(screen.getByLabelText(/check in/i), { target: { value: '09:00' } });
        fireEvent.change(screen.getByLabelText(/check out/i), { target: { value: '18:00' } });
        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Forgot to punch in' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(attendanceCorrectionsApi.createMine).toHaveBeenCalled());
        const payload = (attendanceCorrectionsApi.createMine as any).mock.calls[0][0];
        expect(payload).toMatchObject({
            attendance_date: '2026-08-10',
            requested_check_in: '09:00',
            requested_check_out: '18:00',
            requested_status: 'present',
            reason: 'Forgot to punch in',
        });
        // Safety property: the client never names a person.
        expect(payload).not.toHaveProperty('person_id');
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Correction request submitted'));
        // The list is refreshed after filing
        expect((attendanceCorrectionsApi.listMine as any).mock.calls.length).toBeGreaterThan(1);
    });

    it('When the server refuses / Then the reason is surfaced', async () => {
        (attendanceCorrectionsApi.createMine as any).mockRejectedValue(
            new Error('You already have a pending correction request for this date'),
        );
        await openForm();

        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'dup' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                'You already have a pending correction request for this date',
            ),
        );
    });
});
