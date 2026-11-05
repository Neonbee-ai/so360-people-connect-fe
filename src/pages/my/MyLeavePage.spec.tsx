import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * MyLeavePage — BDD specs.
 *
 * Two behaviours are protected here:
 *  1. The page never names a person. The old flow made the browser supply a
 *     person_id it did not reliably know ("No employee profile found for your
 *     account"). If a person_id reappears in the /me payload, these fail.
 *  2. The request form is the SAME form the admin Leave Requests page uses
 *     (Pulse 78626df8): same labels, half-day options, totals, balance warning
 *     and inline validation. Only the save (/me) and balance source differ.
 */

vi.mock('../../services/meService', () => ({
    meService: {
        myLeaveBalances: vi.fn(),
        myLeaveRequests: vi.fn(),
        requestLeave: vi.fn(),
    },
}));

vi.mock('../../services/leaveConfigService', () => ({
    leaveConfigApi: { getApplicable: vi.fn() },
}));

vi.mock('../../services/leaveRequestsService', () => ({
    leaveRequestsApi: { submit: vi.fn(), getBalances: vi.fn(), getEligibleApprovers: vi.fn() },
}));

vi.mock('../../services/peopleService', () => ({
    peopleApi: { getAll: vi.fn(), getMe: vi.fn() },
}));

vi.mock('@so360/design-system', async () => ({
    ...(await import('../../test/__mocks__/design-system')),
    toast: { success: vi.fn(), error: vi.fn() },
}));

import MyLeavePage from './MyLeavePage';
import { meService } from '../../services/meService';
import { leaveConfigApi } from '../../services/leaveConfigService';
import { leaveRequestsApi } from '../../services/leaveRequestsService';
import { peopleApi } from '../../services/peopleService';
import { toast } from '@so360/design-system';

// Monday 2 Nov 2026 — fixed so "today", past-date checks and weekday totals
// are deterministic. Only Date is faked; debounce timers stay real.
const TODAY = '2026-11-02';
const ANNUAL = { id: 'lt-1', name: 'Annual Leave', code: 'AL', is_active: true };

const renderPage = () =>
    render(
        <MemoryRouter>
            <MyLeavePage />
        </MemoryRouter>,
    );

const openForm = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /request leave/i }));
    await waitFor(() => expect(screen.getByLabelText('Leave Type *')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Annual Leave', { selector: 'option' })).toBeInTheDocument());
};

const chooseType = () => fireEvent.change(screen.getByLabelText('Leave Type *'), { target: { value: 'lt-1' } });
const typeReason = (v: string) => fireEvent.change(screen.getByLabelText('Reason *'), { target: { value: v } });
const setRange = (start: string, end: string) => {
    fireEvent.change(screen.getByLabelText('Start Date *'), { target: { value: start } });
    fireEvent.change(screen.getByLabelText('End Date *'), { target: { value: end } });
};
const submitBtn = () => screen.getByRole('button', { name: 'Submit Request' });
const totalDays = () => screen.getByText(/Total Days:/);

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T09:00:00`));
    (meService.myLeaveBalances as any).mockResolvedValue({
        data: [
            {
                id: 'b1',
                leave_type_id: 'lt-1',
                fiscal_year: 2026,
                opening_balance: 20,
                accrued: 0,
                used: 8,
                pending: 0,
                available: 12,
                leave_type: { id: 'lt-1', code: 'AL', name: 'Annual Leave' },
            },
        ],
    });
    (meService.myLeaveRequests as any).mockResolvedValue({
        data: [
            {
                id: 'r1',
                status: 'pending',
                start_date: '2026-09-01',
                end_date: '2026-09-02',
                total_days: 2,
                leave_type: { id: 'lt-1', name: 'Annual Leave', code: 'AL' },
            },
        ],
        total: 1,
    });
    (meService.requestLeave as any).mockResolvedValue({ id: 'new-request' });
    (leaveConfigApi.getApplicable as any).mockResolvedValue({ leave_types: [ANNUAL] });
    (leaveRequestsApi.submit as any).mockResolvedValue({ id: 'new-request', status: 'pending' });
    (peopleApi.getMe as any).mockResolvedValue({ id: 'me-person', full_name: 'Me' });
    (peopleApi.getAll as any).mockResolvedValue({ data: [] });
    (leaveRequestsApi.getEligibleApprovers as any).mockResolvedValue({
        data: [
            { id: 'mgr-1', full_name: 'Bhaskar R N', job_title: 'Director of Operations', is_suggested: false, is_department_head: true },
            { id: 'mgr-2', full_name: 'Arjun Prince', job_title: 'Founder / Director', is_suggested: false, is_department_head: true },
        ],
        total: 2,
        suggested_approver_id: null,
    });
});

afterEach(() => vi.useRealTimers());

describe('Given an employee opening My Leave', () => {
    it('When the page loads / Then their own balance is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
        expect(screen.getAllByText(/Annual Leave/).length).toBeGreaterThan(0);
        expect(screen.getByText(/days available/)).toBeInTheDocument();
    });

    it("When the page loads / Then it asks only for the caller's own records", async () => {
        renderPage();
        await waitFor(() => expect(meService.myLeaveRequests).toHaveBeenCalled());
        expect((meService.myLeaveRequests as any).mock.calls[0][0]).not.toHaveProperty('person_id');
    });

    it('When they have no requests / Then an empty state is shown, not a blank page', async () => {
        (meService.myLeaveRequests as any).mockResolvedValue({ data: [], total: 0 });
        renderPage();
        await waitFor(() => expect(screen.getByText(/No leave requests yet/i)).toBeInTheDocument());
    });

    it('When no balances are set up / Then the requests list still renders', async () => {
        (meService.myLeaveBalances as any).mockResolvedValue({ data: [] });
        renderPage();
        await waitFor(() => expect(screen.getByText(/My requests/i)).toBeInTheDocument());
    });
});

describe('Given the employee opens the request form (same form as admin, Pulse 78626df8)', () => {
    it('When it opens / Then it uses the admin form title, labels and half-day option', async () => {
        await openForm();
        expect(screen.getByRole('dialog', { name: 'Request Leave' })).toBeInTheDocument();
        expect(screen.getByLabelText('Start Date *')).toBeInTheDocument();
        expect(screen.getByLabelText('End Date *')).toBeInTheDocument();
        expect(screen.getByLabelText('Reason *')).toBeInTheDocument();
        expect(screen.getByText('Half Day (this day only)')).toBeInTheDocument();
    });

    it('When it opens / Then only the leave types applicable to this employee are offered', async () => {
        await openForm();
        expect(leaveConfigApi.getApplicable).toHaveBeenCalledWith('me-person');
    });

    it('When it opens / Then balances are read through /me, not the admin balances endpoint', async () => {
        await openForm();
        await waitFor(() => expect((meService.myLeaveBalances as any).mock.calls.length).toBeGreaterThan(1));
        expect(leaveRequestsApi.getBalances).not.toHaveBeenCalled();
    });

    it('When no leave type or reason is entered / Then submit is disabled and nothing is sent', async () => {
        await openForm();
        expect(submitBtn()).toBeDisabled();
        fireEvent.click(submitBtn());
        expect(meService.requestLeave).not.toHaveBeenCalled();
    });

    it('When the end date precedes the start / Then an inline error shows and submit is disabled', async () => {
        await openForm();
        chooseType();
        typeReason('Trip');
        fireEvent.change(screen.getByLabelText('Start Date *'), { target: { value: '2026-11-10' } });
        fireEvent.change(screen.getByLabelText('End Date *'), { target: { value: '2026-11-05' } });
        expect(await screen.findByText('End date cannot be earlier than start date.')).toBeInTheDocument();
        expect(submitBtn()).toBeDisabled();
    });

    it('When the reason is only whitespace / Then submit stays disabled', async () => {
        await openForm();
        chooseType();
        typeReason('   ');
        await waitFor(() => expect(screen.getByText('Reason is required.')).toBeInTheDocument());
        expect(submitBtn()).toBeDisabled();
    });
});

describe('Given an employee submitting a valid request', () => {
    it('When they submit / Then no person_id is sent and the fields are carried over', async () => {
        await openForm();
        chooseType();
        setRange('2026-12-01', '2026-12-04');
        typeReason('Family event');
        await waitFor(() => expect(submitBtn()).toBeEnabled());
        fireEvent.click(submitBtn());

        await waitFor(() => expect(meService.requestLeave).toHaveBeenCalled());
        const payload = (meService.requestLeave as any).mock.calls[0][0];
        expect(payload).not.toHaveProperty('person_id');
        expect(payload).toMatchObject({
            leave_type_id: 'lt-1',
            start_date: '2026-12-01',
            end_date: '2026-12-04',
            reason: 'Family event',
        });
    });

    it('When a start half-day is ticked / Then it reaches the /me payload', async () => {
        await openForm();
        chooseType();
        setRange('2026-12-01', '2026-12-03');
        typeReason('Trip');
        fireEvent.click(screen.getByLabelText('Start Date – Half Day'));
        await waitFor(() => expect(totalDays()).toHaveTextContent('2.5'));
        fireEvent.click(submitBtn());

        await waitFor(() => expect(meService.requestLeave).toHaveBeenCalled());
        expect((meService.requestLeave as any).mock.calls[0][0]).toMatchObject({ is_half_day_start: true, is_half_day_end: false });
    });

    it('When it succeeds / Then the request is submitted and the list refreshes', async () => {
        await openForm();
        chooseType();
        typeReason('Trip');
        await waitFor(() => expect(submitBtn()).toBeEnabled());
        fireEvent.click(submitBtn());

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Leave requested'));
        expect(leaveRequestsApi.submit).toHaveBeenCalledWith('new-request', []);
        expect((meService.myLeaveRequests as any).mock.calls.length).toBeGreaterThan(1);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('When the server refuses / Then the reason is surfaced and the form stays open', async () => {
        (meService.requestLeave as any).mockRejectedValue(new Error('No employee profile is linked to your account.'));
        await openForm();
        chooseType();
        typeReason('Trip');
        await waitFor(() => expect(submitBtn()).toBeEnabled());
        fireEvent.click(submitBtn());

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No employee profile is linked to your account.'));
        expect(leaveRequestsApi.submit).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('When the server throws a non-Error / Then a generic message is shown', async () => {
        (meService.requestLeave as any).mockRejectedValue('boom');
        await openForm();
        chooseType();
        typeReason('Trip');
        await waitFor(() => expect(submitBtn()).toBeEnabled());
        fireEvent.click(submitBtn());

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not submit your request'));
    });

    it('When managers are selected / Then the request is submitted to those approver ids', async () => {
        await openForm();
        await waitFor(() => expect(screen.getByRole('button', { name: /^Bhaskar R N/ })).toBeInTheDocument());
        chooseType();
        typeReason('Trip');
        fireEvent.click(screen.getByRole('button', { name: /^Bhaskar R N/ }));
        fireEvent.click(screen.getByRole('button', { name: /^Arjun Prince/ }));
        fireEvent.click(submitBtn());

        await waitFor(() => expect(leaveRequestsApi.submit).toHaveBeenCalledWith('new-request', ['mgr-1', 'mgr-2']));
        expect(leaveRequestsApi.getEligibleApprovers).toHaveBeenCalledWith('me-person', expect.objectContaining({ limit: 25 }));
    });
});

describe('Given an employee requesting more days than their balance', () => {
    it('When the weekdays in the range exceed the balance / Then a warning shows and submit is blocked', async () => {
        await openForm();
        chooseType();
        typeReason('Trip');
        setRange('2026-12-01', '2026-12-31'); // 23 weekdays > 12 available
        await waitFor(() => expect(screen.getByText(/only 12 are available/)).toBeInTheDocument());
        expect(totalDays()).toHaveTextContent('23');
        expect(submitBtn()).toBeDisabled();
    });

    it('When the range fits the balance / Then no warning shows and submit is enabled', async () => {
        await openForm();
        chooseType();
        typeReason('Trip');
        setRange('2026-12-01', '2026-12-03');
        await waitFor(() => expect(totalDays()).toHaveTextContent('3'));
        expect(screen.queryByText(/are available/)).not.toBeInTheDocument();
        expect(submitBtn()).toBeEnabled();
    });

    it('When the leave type has no accrual / Then the balance never blocks the request', async () => {
        (leaveConfigApi.getApplicable as any).mockResolvedValue({ leave_types: [{ ...ANNUAL, accrual_type: 'none' }] });
        await openForm();
        chooseType();
        typeReason('Trip');
        setRange('2026-12-01', '2026-12-31');
        await waitFor(() => expect(totalDays()).toHaveTextContent('23'));
        expect(screen.queryByText(/are available/)).not.toBeInTheDocument();
        expect(submitBtn()).toBeEnabled();
    });
});

describe('Given the request form is dismissed', () => {
    it('When cancel is pressed / Then nothing is submitted and the form closes', async () => {
        await openForm();
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(meService.requestLeave).not.toHaveBeenCalled();
    });
});
