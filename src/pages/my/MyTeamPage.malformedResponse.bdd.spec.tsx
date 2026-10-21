import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

const setAll = (v: unknown) => {
    (meService.whosOut as any).mockResolvedValue(v);
    (meService.directory as any).mockResolvedValue(v);
    (meService.myTeamLeaveRequests as any).mockResolvedValue(v);
};

describe('MyTeamPage tolerates non-array /me/team responses', () => {
    beforeEach(() => vi.clearAllMocks());

    it('given no employee record (data undefined), when the page loads, then it renders the empty state without crashing', async () => {
        setAll({ data: undefined });
        render(<MyTeamPage />);
        await waitFor(() => expect(meService.directory).toHaveBeenCalled());
        await waitFor(() => expect(screen.queryByText(/Team leave approvals/i)).toBeNull());
        expect(document.body.textContent).toBeTruthy();
    });

    it('given empty lists, when the page loads, then no team approvals card is shown', async () => {
        setAll({ data: [] });
        render(<MyTeamPage />);
        await waitFor(() => expect(meService.myTeamLeaveRequests).toHaveBeenCalled());
        expect(screen.queryByText(/Team leave approvals/i)).toBeNull();
    });

    it('given an object-shaped response ({ data: { data: [] } } or {}), when the page loads, then it does not crash', async () => {
        setAll({ data: { data: [] } });
        const { unmount } = render(<MyTeamPage />);
        await waitFor(() => expect(meService.whosOut).toHaveBeenCalled());
        unmount();
        setAll({ data: {} });
        render(<MyTeamPage />);
        await waitFor(() => expect(meService.whosOut).toHaveBeenCalledTimes(2));
        expect(screen.queryByText(/Team leave approvals/i)).toBeNull();
    });
});
