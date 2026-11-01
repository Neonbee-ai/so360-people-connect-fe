import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../services/meService', () => ({
    meService: {
        myOpenSession: vi.fn(), myAttendance: vi.fn(), myAllocations: vi.fn(),
        clockIn: vi.fn(), clockOut: vi.fn(), startBreak: vi.fn(), endBreak: vi.fn(),
    },
}));
vi.mock('../../services/attendanceService', () => ({
    attendanceCorrectionsApi: { createMine: vi.fn(), listMine: vi.fn(), list: vi.fn(), approve: vi.fn(), reject: vi.fn() },
}));

import MyTimePage from './MyTimePage';
import { meService } from '../../services/meService';
import { attendanceCorrectionsApi } from '../../services/attendanceService';

const openSession = {
    id: 's1', person_id: 'p1', entity_type: 'project_task', entity_id: 'e1', entity_name: 'Fit-out',
    started_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(), break_started_at: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    (meService.myOpenSession as any).mockResolvedValue({ session: null });
    (meService.myAttendance as any).mockResolvedValue({ data: [] });
    (meService.myAllocations as any).mockResolvedValue({ data: [] });
    (meService.clockOut as any).mockResolvedValue({});
    (attendanceCorrectionsApi.listMine as any).mockResolvedValue({ data: [], total: 0 });
    (attendanceCorrectionsApi.createMine as any).mockResolvedValue({ id: 'c1', status: 'pending' });
});

describe('Given MyTimePage on the Comb dashboard template', () => {
    it('When not clocked in / Then the heading and not-clocked-in card show', async () => {
        render(<MyTimePage />);
        expect(screen.getByRole('heading', { name: 'My Time' })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText(/not clocked in/i)).toBeInTheDocument());
    });

    it('When no allocations exist / Then the assignment hint shows', async () => {
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByText(/no active work assignments/i)).toBeInTheDocument());
    });

    it('When clocked in / Then the session, elapsed time and Clock out show', async () => {
        (meService.myOpenSession as any).mockResolvedValue({ session: openSession });
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByText(/Fit-out/)).toBeInTheDocument());
        expect(screen.getByText(/1h 30m ago/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /clock out/i }));
        await waitFor(() => expect(meService.clockOut).toHaveBeenCalled());
    });

    it('When Request correction is opened / Then the form appears with a disabled submit', async () => {
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByText(/not clocked in/i)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /request correction/i }));
        expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /submit request/i })).toBeDisabled();
    });

    it('When a reason and times are filed / Then createMine gets the payload', async () => {
        render(<MyTimePage />);
        await waitFor(() => expect(screen.getByText(/not clocked in/i)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /request correction/i }));
        fireEvent.change(screen.getByLabelText(/check in/i), { target: { value: '09:00' } });
        fireEvent.change(screen.getByLabelText(/check out/i), { target: { value: '18:00' } });
        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Forgot to punch' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
        await waitFor(() => expect(attendanceCorrectionsApi.createMine).toHaveBeenCalled());
        expect((attendanceCorrectionsApi.createMine as any).mock.calls[0][0]).toMatchObject({
            requested_check_in: '09:00', requested_check_out: '18:00', reason: 'Forgot to punch',
        });
    });
});
