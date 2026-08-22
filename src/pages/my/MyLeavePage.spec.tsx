import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * MyLeavePage — BDD specs.
 *
 * The behaviour worth protecting is that this page never names a person. The
 * old flow made the browser supply a person_id it did not reliably know, which
 * is what produced "No employee profile found for your account" on the Request
 * Leave button. If a future change reintroduces a person_id into this payload,
 * these specs fail.
 */

vi.mock('../../services/meService', () => ({
    meService: {
        myLeaveBalances: vi.fn(),
        myLeaveRequests: vi.fn(),
        requestLeave: vi.fn(),
    },
}));

vi.mock('../../services/leaveTypesService', () => ({
    leaveTypesApi: { getAll: vi.fn() },
    LeaveType: {},
}));

vi.mock('../../services/leaveRequestsService', () => ({
    leaveRequestsApi: { submit: vi.fn() },
}));

vi.mock('../../services/peopleService', () => ({
    peopleApi: { getAll: vi.fn() },
}));

vi.mock('@so360/design-system', async () => {
    const React = (await import('react')).default;
    return {
        toast: { success: vi.fn(), error: vi.fn() },
        // Faithful-enough Drawer: renders only when open, children + footer
        // present — mirrors src/test/__mocks__/design-system.ts.
        Drawer: ({ isOpen, onClose, title, footer, children }: any) =>
            isOpen
                ? React.createElement(
                      'div',
                      { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
                      React.createElement('h2', null, title),
                      React.createElement('button', { type: 'button', 'aria-label': 'Close', onClick: onClose }),
                      children,
                      footer ?? null,
                  )
                : null,
    };
});

import MyLeavePage from './MyLeavePage';
import { meService } from '../../services/meService';
import { leaveTypesApi } from '../../services/leaveTypesService';
import { leaveRequestsApi } from '../../services/leaveRequestsService';
import { peopleApi } from '../../services/peopleService';
import { toast } from '@so360/design-system';

const renderPage = () =>
    render(
        <MemoryRouter>
            <MyLeavePage />
        </MemoryRouter>,
    );

beforeEach(() => {
    vi.clearAllMocks();
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
    (leaveTypesApi.getAll as any).mockResolvedValue({
        data: [{ id: 'lt-1', name: 'Annual Leave', code: 'AL', is_active: true }],
    });
    (meService.requestLeave as any).mockResolvedValue({ id: 'new-request' });
    (leaveRequestsApi.submit as any).mockResolvedValue({ id: 'new-request', status: 'pending' });
    (peopleApi.getAll as any).mockResolvedValue({
        data: [
            { id: 'mgr-1', full_name: 'Bhaskar R N', job_title: 'Director of Operations', status: 'active' },
            { id: 'mgr-2', full_name: 'Arjun Prince', job_title: 'Founder / Director', status: 'active' },
        ],
    });
});

describe('Given an employee opening My Leave', () => {
    it('When the page loads / Then their own balance is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
        // The type name appears in both the balance card and the request row.
        expect(screen.getAllByText(/Annual Leave/).length).toBeGreaterThan(0);
        expect(screen.getByText(/days available/)).toBeInTheDocument();
    });

    it('When the page loads / Then it asks only for the caller\'s own records', async () => {
        renderPage();
        await waitFor(() => expect(meService.myLeaveRequests).toHaveBeenCalled());

        // The self-service client exposes no person_id at all; asserting the
        // call shape keeps it that way.
        const arg = (meService.myLeaveRequests as any).mock.calls[0][0];
        expect(arg).not.toHaveProperty('person_id');
    });

    it('When they have no requests / Then an empty state is shown, not a blank page', async () => {
        (meService.myLeaveRequests as any).mockResolvedValue({ data: [], total: 0 });
        renderPage();

        await waitFor(() =>
            expect(screen.getByText(/No leave requests yet/i)).toBeInTheDocument(),
        );
    });
});

describe('Given an employee requesting leave', () => {
    const openForm = async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /request leave/i }));
        await waitFor(() =>
            expect(screen.getByText(/Leave type/i)).toBeInTheDocument(),
        );
    };

    it('When they submit / Then no person_id is sent', async () => {
        await openForm();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lt-1' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(meService.requestLeave).toHaveBeenCalled());
        const payload = (meService.requestLeave as any).mock.calls[0][0];

        // The whole fix: the server derives the person from the session.
        expect(payload).not.toHaveProperty('person_id');
        expect(payload.leave_type_id).toBe('lt-1');
    });

    it('When no leave type is chosen / Then it is refused before hitting the API', async () => {
        await openForm();
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(meService.requestLeave).not.toHaveBeenCalled();
    });

    it('When the end date precedes the start / Then it is refused', async () => {
        await openForm();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lt-1' } });
        const dates = screen.getAllByDisplayValue(new Date().toISOString().slice(0, 10));
        fireEvent.change(dates[1], { target: { value: '2020-01-01' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(meService.requestLeave).not.toHaveBeenCalled();
    });

    it('When the server refuses / Then the reason is surfaced to the employee', async () => {
        // An employee whose account still is not linked must be told why, not
        // left watching a request disappear.
        (meService.requestLeave as any).mockRejectedValue(
            new Error('No employee profile is linked to your account.'),
        );
        await openForm();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lt-1' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                'No employee profile is linked to your account.',
            ),
        );
    });

    it('When it succeeds / Then the list refreshes', async () => {
        await openForm();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lt-1' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Leave requested'));
        // Once on mount, once after the successful submit.
        expect((meService.myLeaveRequests as any).mock.calls.length).toBeGreaterThan(1);
    });
});

describe('Given an employee selecting a manager to approve their leave', () => {
    const openForm = async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /request leave/i }));
        await waitFor(() => expect(screen.getByText(/Manager \/ Approver/i)).toBeInTheDocument());
    };

    it('When the form opens / Then active people from the registry are listed as candidates', async () => {
        await openForm();
        await waitFor(() => expect(peopleApi.getAll).toHaveBeenCalledWith({ status: 'active', limit: 200 }));
        expect(screen.getByText('Bhaskar R N')).toBeInTheDocument();
        expect(screen.getByText('Arjun Prince')).toBeInTheDocument();
    });

    it('When they select managers and submit / Then the request is created then submitted with those approver ids', async () => {
        await openForm();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lt-1' } });
        fireEvent.click(screen.getByText('Bhaskar R N'));
        fireEvent.click(screen.getByText('Arjun Prince'));
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(leaveRequestsApi.submit).toHaveBeenCalled());
        expect(leaveRequestsApi.submit).toHaveBeenCalledWith('new-request', ['mgr-1', 'mgr-2']);
    });

    it('When no manager is selected / Then submit still routes via the department-head fallback (empty list)', async () => {
        await openForm();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lt-1' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(leaveRequestsApi.submit).toHaveBeenCalledWith('new-request', []));
    });

    it('When a selected manager is clicked again / Then it is deselected', async () => {
        await openForm();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lt-1' } });
        fireEvent.click(screen.getByText('Bhaskar R N'));
        fireEvent.click(screen.getByText('Bhaskar R N'));
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(leaveRequestsApi.submit).toHaveBeenCalledWith('new-request', []));
    });

    it('When searching by name / Then non-matching people are filtered out', async () => {
        await openForm();

        const search = screen.getByPlaceholderText(/search by name/i);
        fireEvent.change(search, { target: { value: 'bha' } });

        expect(screen.getByText('Bhaskar R N')).toBeInTheDocument();
        expect(screen.queryByText('Arjun Prince')).not.toBeInTheDocument();
    });
});

describe('Given the request form is dismissed', () => {
    it('When cancel is pressed / Then nothing is submitted and the form closes', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /request leave/i }));
        await waitFor(() => expect(screen.getByText(/Leave type/i)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

        await waitFor(() =>
            expect(screen.queryByRole('button', { name: /submit request/i })).not.toBeInTheDocument(),
        );
        expect(meService.requestLeave).not.toHaveBeenCalled();
    });

    it('When dates and a reason are edited / Then the values are carried into the payload', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /request leave/i }));
        await waitFor(() => expect(screen.getByText(/Leave type/i)).toBeInTheDocument());

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lt-1' } });
        const dates = screen.getAllByDisplayValue(new Date().toISOString().slice(0, 10));
        fireEvent.change(dates[0], { target: { value: '2026-12-01' } });
        fireEvent.change(dates[1], { target: { value: '2026-12-05' } });
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Family event' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(meService.requestLeave).toHaveBeenCalled());
        const payload = (meService.requestLeave as any).mock.calls[0][0];
        expect(payload.start_date).toBe('2026-12-01');
        expect(payload.end_date).toBe('2026-12-05');
        expect(payload.reason).toBe('Family event');
    });

    it('When no reason is typed / Then the field is omitted rather than sent empty', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /request leave/i }));
        await waitFor(() => expect(screen.getByText(/Leave type/i)).toBeInTheDocument());

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lt-1' } });
        fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

        await waitFor(() => expect(meService.requestLeave).toHaveBeenCalled());
        expect((meService.requestLeave as any).mock.calls[0][0].reason).toBeUndefined();
    });
});

describe('Given no balances have been set up', () => {
    it('When the page loads / Then the requests list still renders', async () => {
        (meService.myLeaveBalances as any).mockResolvedValue({ data: [] });
        renderPage();

        await waitFor(() => expect(screen.getByText(/My requests/i)).toBeInTheDocument());
    });

    it('When leave types cannot be loaded / Then the page still opens', async () => {
        (leaveTypesApi.getAll as any).mockRejectedValue(new Error('types down'));
        renderPage();

        await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    });
});
