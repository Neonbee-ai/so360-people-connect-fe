import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * MyTeamPage — BDD specs.
 *
 * This page is the redacted replacement for showing employees the admin Leave
 * Calendar. The specs pin what it must NEVER render, because a future change
 * that widens the backend payload would otherwise silently start leaking
 * colleagues' leave reasons into the UI.
 */

vi.mock('../../services/meService', () => ({
    meService: { whosOut: vi.fn(), directory: vi.fn() },
}));

import MyTeamPage from './MyTeamPage';
import { meService } from '../../services/meService';

beforeEach(() => {
    vi.clearAllMocks();
    (meService.whosOut as any).mockResolvedValue({
        data: [
            {
                person_id: 'p1',
                full_name: 'Priya R',
                job_title: 'Engineer',
                department_id: 'd1',
                start_date: '2026-09-01',
                end_date: '2026-09-03',
                is_half_day_start: false,
                is_half_day_end: false,
            },
        ],
    });
    (meService.directory as any).mockResolvedValue({
        data: [
            {
                id: 'p2',
                full_name: 'Sam K',
                job_title: 'Designer',
                department_id: 'd1',
                email: 'sam@example.com',
                avatar_url: null,
            },
        ],
    });
});

describe("Given an employee viewing Who's Out", () => {
    it('When it loads / Then colleagues who are away are listed with dates', async () => {
        render(<MyTeamPage />);

        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());
        expect(screen.getByText('2026-09-01 → 2026-09-03')).toBeInTheDocument();
    });

    it('When it loads / Then it only ever asks the redacted endpoint', async () => {
        render(<MyTeamPage />);

        await waitFor(() => expect(meService.whosOut).toHaveBeenCalled());
        // The admin leave-requests API would carry reason/type/approver; this
        // page must never reach for it.
        expect((meService as any).myLeaveRequests).toBeUndefined();
    });

    it('When a colleague is away / Then no reason or leave type is displayed', async () => {
        // Even if the backend regressed and started returning them, they must
        // not reach the screen.
        (meService.whosOut as any).mockResolvedValue({
            data: [
                {
                    person_id: 'p1',
                    full_name: 'Priya R',
                    job_title: 'Engineer',
                    department_id: 'd1',
                    start_date: '2026-09-01',
                    end_date: '2026-09-03',
                    is_half_day_start: false,
                    is_half_day_end: false,
                    reason: 'Surgery recovery',
                    leave_type: { name: 'Sick Leave' },
                } as any,
            ],
        });

        render(<MyTeamPage />);
        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());

        expect(screen.queryByText(/Surgery recovery/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Sick Leave/)).not.toBeInTheDocument();
    });

    it('When nobody is away / Then a plain message is shown', async () => {
        (meService.whosOut as any).mockResolvedValue({ data: [] });
        render(<MyTeamPage />);

        await waitFor(() =>
            expect(screen.getByText(/Nobody is scheduled to be away/i)).toBeInTheDocument(),
        );
    });
});

describe('Given an employee browsing the directory', () => {
    const openDirectory = async () => {
        render(<MyTeamPage />);
        await waitFor(() => expect(screen.getByText('Priya R')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /directory/i }));
    };

    it('When opened / Then colleagues are listed with work contact details', async () => {
        await openDirectory();

        await waitFor(() => expect(screen.getByText('Sam K')).toBeInTheDocument());
        expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    });

    it('When searching / Then the list narrows', async () => {
        await openDirectory();
        await waitFor(() => expect(screen.getByText('Sam K')).toBeInTheDocument());

        fireEvent.change(screen.getByPlaceholderText(/search colleagues/i), {
            target: { value: 'nobody' },
        });

        expect(screen.queryByText('Sam K')).not.toBeInTheDocument();
        expect(screen.getByText(/No colleagues found/i)).toBeInTheDocument();
    });
});
