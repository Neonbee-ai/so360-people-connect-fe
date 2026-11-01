import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/meService', () => ({
    meService: { myLeaveBalances: vi.fn(), myLeaveRequests: vi.fn(), requestLeave: vi.fn() },
}));
vi.mock('../../services/leaveTypesService', () => ({
    leaveTypesApi: { getAll: vi.fn() },
    LeaveType: {},
}));
vi.mock('../../services/leaveRequestsService', () => ({
    leaveRequestsApi: { submit: vi.fn(), getEligibleApprovers: vi.fn().mockResolvedValue({ data: [], total: 0, suggested_approver_id: null }) },
}));
vi.mock('../../services/peopleService', () => ({
    peopleApi: { getAll: vi.fn().mockResolvedValue({ data: [] }), getMe: vi.fn().mockResolvedValue({ id: 'me', full_name: 'Me' }) },
}));

import MyLeavePage from './MyLeavePage';
import { meService } from '../../services/meService';
import { leaveTypesApi } from '../../services/leaveTypesService';

const renderPage = () => render(<MemoryRouter><MyLeavePage /></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks();
    (meService.myLeaveBalances as any).mockResolvedValue({
        data: [{ id: 'b1', leave_type_id: 'lt-1', used: 8, available: 12, leave_type: { id: 'lt-1', name: 'Annual Leave' } }],
    });
    (meService.myLeaveRequests as any).mockResolvedValue({
        data: [{ id: 'r1', status: 'pending', start_date: '2026-09-01', end_date: '2026-09-02', total_days: 2, leave_type: { id: 'lt-1', name: 'Annual Leave' } }],
        total: 1,
    });
    (leaveTypesApi.getAll as any).mockResolvedValue({ data: [{ id: 'lt-1', name: 'Annual Leave', code: 'AL', is_active: true }] });
});

describe('Given MyLeavePage on the Comb dashboard template', () => {
    it('When it renders / Then the heading and Request leave action show', async () => {
        renderPage();
        expect(screen.getByRole('heading', { name: 'My Leave' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /request leave/i })).toBeInTheDocument();
        await waitFor(() => expect(meService.myLeaveBalances).toHaveBeenCalled());
    });

    it('When balances load / Then a KPI tile shows the leave type and hint', async () => {
        renderPage();
        await waitFor(() => expect(screen.getAllByText('Annual Leave').length).toBeGreaterThan(0));
        expect(screen.getByText(/days available · 8 used/)).toBeInTheDocument();
    });

    it('When requests load / Then the request date range and status show', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('pending')).toBeInTheDocument());
    });

    it('When there are no requests / Then the empty state shows', async () => {
        (meService.myLeaveRequests as any).mockResolvedValue({ data: [], total: 0 });
        renderPage();
        await waitFor(() => expect(screen.getByText('No leave requests yet')).toBeInTheDocument());
    });
});
