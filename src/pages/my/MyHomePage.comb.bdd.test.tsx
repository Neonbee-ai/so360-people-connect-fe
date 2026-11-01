import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/meService', () => ({
    meService: {
        myLeaveBalances: vi.fn(),
        myLeaveRequests: vi.fn(),
        myGoals: vi.fn(),
        whosOut: vi.fn(),
    },
}));

vi.mock('../../services/onboardingService', () => ({
    myOnboardingApi: { get: vi.fn().mockResolvedValue({ instance: null, items: [] }), completeItem: vi.fn(), uploadItemDocument: vi.fn() },
}));

import MyHomePage from './MyHomePage';
import { meService } from '../../services/meService';

const renderPage = () => render(<MemoryRouter><MyHomePage /></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks();
    (meService.myLeaveBalances as any).mockResolvedValue({ data: [{ id: 'b1', available: 12, leave_type: { name: 'Annual Leave' } }] });
    (meService.myLeaveRequests as any).mockResolvedValue({ data: [{ id: 'r1', status: 'pending', start_date: '2026-09-01', end_date: '2026-09-02' }], total: 1 });
    (meService.myGoals as any).mockResolvedValue({ data: [{ id: 'g1', title: 'Ship ESS', progress_percentage: 40, target_date: '2026-12-01' }], total: 1 });
    (meService.whosOut as any).mockResolvedValue({ data: [{ person_id: 'p2', full_name: 'Priya R', start_date: '2026-09-05', end_date: '2026-09-05' }] });
});

describe('Given MyHomePage on the Comb dashboard template', () => {
    it('When it renders / Then the Overview heading shows', async () => {
        renderPage();
        expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
        await waitFor(() => expect(meService.whosOut).toHaveBeenCalled());
    });

    it('When data loads / Then the leave balance is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('12 days')).toBeInTheDocument());
    });

    it('When data loads / Then the goal title is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Ship ESS')).toBeInTheDocument());
    });

    it('When data loads / Then who is out lists the colleague', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());
    });

    it('When goals fail / Then the other panels still render', async () => {
        (meService.myGoals as any).mockRejectedValue(new Error('boom'));
        renderPage();
        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());
    });
});
