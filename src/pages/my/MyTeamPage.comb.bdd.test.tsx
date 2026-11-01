import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../services/meService', () => ({
    meService: {
        whosOut: vi.fn(),
        directory: vi.fn(),
        myTeamLeaveRequests: vi.fn(),
        approveTeamLeaveRequest: vi.fn(),
        rejectTeamLeaveRequest: vi.fn(),
    },
}));

import MyTeamPage from './MyTeamPage';
import { meService } from '../../services/meService';

beforeEach(() => {
    vi.clearAllMocks();
    (meService.whosOut as any).mockResolvedValue({ data: [{ person_id: 'p1', full_name: 'Priya R', job_title: 'Engineer', start_date: '2026-09-01', end_date: '2026-09-03' }] });
    (meService.directory as any).mockResolvedValue({ data: [{ id: 'p2', full_name: 'Sam K', job_title: 'Designer', email: 'sam@example.com', avatar_url: null }] });
    (meService.myTeamLeaveRequests as any).mockResolvedValue({ data: [], total: 0 });
});

describe('Given MyTeamPage on the Comb dashboard template', () => {
    it('When it renders / Then the heading and Who is out list show', async () => {
        render(<MyTeamPage />);
        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());
    });

    it('When the caller heads no department / Then no team leave approvals card shows', async () => {
        render(<MyTeamPage />);
        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());
        expect(screen.queryByText('Team leave approvals')).not.toBeInTheDocument();
    });

    it('When Directory is chosen / Then colleagues are listed with a search box', async () => {
        render(<MyTeamPage />);
        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /directory/i }));
        await waitFor(() => expect(screen.getByText('Sam K')).toBeInTheDocument());
        expect(screen.getByPlaceholderText('Search colleagues')).toBeInTheDocument();
    });

    it('When a search matches nobody / Then the empty message shows', async () => {
        render(<MyTeamPage />);
        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /directory/i }));
        await waitFor(() => expect(screen.getByText('Sam K')).toBeInTheDocument());
        fireEvent.change(screen.getByPlaceholderText('Search colleagues'), { target: { value: 'zzz' } });
        expect(screen.getByText('No colleagues found.')).toBeInTheDocument();
    });

    it('When a pending team request exists / Then Approve calls the approve API', async () => {
        (meService.myTeamLeaveRequests as any).mockResolvedValue({
            data: [{ id: 'lr1', person_id: 'p9', start_date: '2026-09-10', end_date: '2026-09-12', status: 'pending', reason: 'Family event', person: { id: 'p9', full_name: 'Manu Member' } }],
            total: 1,
        });
        (meService.approveTeamLeaveRequest as any).mockResolvedValue({ status: 'approved' });
        render(<MyTeamPage />);
        await waitFor(() => expect(screen.getByText('Manu Member')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /approve/i }));
        await waitFor(() => expect(meService.approveTeamLeaveRequest).toHaveBeenCalled());
    });
});
