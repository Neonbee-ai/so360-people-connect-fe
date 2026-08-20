import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * MyHomePage — BDD specs.
 *
 * The employee's landing page. Its defining behaviour is that each panel is
 * independent: one failing source degrades that card only. A single
 * Promise.all would blank the whole page when, say, goals is unavailable —
 * leaving an employee with nothing on the one screen built for them.
 */

vi.mock('../../services/meService', () => ({
    meService: {
        myLeaveBalances: vi.fn(),
        myLeaveRequests: vi.fn(),
        myGoals: vi.fn(),
        whosOut: vi.fn(),
    },
}));

import MyHomePage from './MyHomePage';
import { meService } from '../../services/meService';

const renderPage = () =>
    render(
        <MemoryRouter>
            <MyHomePage />
        </MemoryRouter>,
    );

beforeEach(() => {
    vi.clearAllMocks();
    (meService.myLeaveBalances as any).mockResolvedValue({
        data: [{ id: 'b1', available: 12, leave_type: { name: 'Annual Leave' } }],
    });
    (meService.myLeaveRequests as any).mockResolvedValue({
        data: [
            { id: 'r1', status: 'pending', start_date: '2026-09-01', end_date: '2026-09-02' },
        ],
        total: 1,
    });
    (meService.myGoals as any).mockResolvedValue({
        data: [{ id: 'g1', title: 'Ship ESS', progress_percentage: 40, target_date: '2026-12-01' }],
        total: 1,
    });
    (meService.whosOut as any).mockResolvedValue({
        data: [
            {
                person_id: 'p2',
                full_name: 'Priya R',
                start_date: '2026-09-05',
                end_date: '2026-09-05',
            },
        ],
    });
});

describe('Given an employee landing on My Work', () => {
    it('When it loads / Then all four panels render their own data', async () => {
        renderPage();

        await waitFor(() => expect(screen.getByText('12 days')).toBeInTheDocument());
        expect(screen.getByText('Ship ESS')).toBeInTheDocument();
        expect(screen.getByText('Priya R')).toBeInTheDocument();
        expect(screen.getByText('2026-09-01 → 2026-09-02')).toBeInTheDocument();
    });

    it('When a request is awaiting approval / Then the count is called out', async () => {
        renderPage();
        await waitFor(() =>
            expect(screen.getByText(/1 awaiting approval/i)).toBeInTheDocument(),
        );
    });

    it('When it loads / Then only self-scoped endpoints are called', async () => {
        renderPage();

        await waitFor(() => expect(meService.myGoals).toHaveBeenCalled());
        expect(meService.myLeaveBalances).toHaveBeenCalled();
        expect(meService.myLeaveRequests).toHaveBeenCalled();
        expect(meService.whosOut).toHaveBeenCalled();
    });
});

describe('Given one data source is unavailable', () => {
    it('When goals fails / Then the other panels still render', async () => {
        // The reason each source is settled independently rather than awaited
        // together.
        (meService.myGoals as any).mockRejectedValue(new Error('goals down'));
        renderPage();

        await waitFor(() => expect(screen.getByText('12 days')).toBeInTheDocument());
        expect(screen.getByText('Priya R')).toBeInTheDocument();
        expect(screen.getByText(/No active goals/i)).toBeInTheDocument();
    });

    it('When every source fails / Then the page still renders empty states', async () => {
        (meService.myLeaveBalances as any).mockRejectedValue(new Error('x'));
        (meService.myLeaveRequests as any).mockRejectedValue(new Error('x'));
        (meService.myGoals as any).mockRejectedValue(new Error('x'));
        (meService.whosOut as any).mockRejectedValue(new Error('x'));

        renderPage();

        await waitFor(() =>
            expect(screen.getByText(/No leave balances have been set up/i)).toBeInTheDocument(),
        );
        expect(screen.getByText(/haven't requested any leave/i)).toBeInTheDocument();
        expect(screen.getByText(/Nobody is scheduled to be away/i)).toBeInTheDocument();
    });
});

describe('Given a colleague is away', () => {
    it('When the panel renders / Then no reason or leave type is shown', async () => {
        (meService.whosOut as any).mockResolvedValue({
            data: [
                {
                    person_id: 'p2',
                    full_name: 'Priya R',
                    start_date: '2026-09-05',
                    end_date: '2026-09-05',
                    reason: 'Medical',
                    leave_type: { name: 'Sick Leave' },
                } as any,
            ],
        });

        renderPage();
        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());

        expect(screen.queryByText(/Medical/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Sick Leave/)).not.toBeInTheDocument();
    });
});
