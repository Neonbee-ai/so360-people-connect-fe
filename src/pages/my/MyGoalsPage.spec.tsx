import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

/**
 * MyGoalsPage — BDD specs.
 *
 * Read-only on purpose: the admin Goals page writes
 * `person_id: apiContext.getUserId()`, putting a user uuid in a person field.
 * A spec asserts no write path exists here so that bug cannot be copied in
 * later by someone adding an edit button.
 */

vi.mock('../../services/meService', () => ({
    meService: { myGoals: vi.fn() },
}));

import MyGoalsPage from './MyGoalsPage';
import { meService } from '../../services/meService';

beforeEach(() => {
    vi.clearAllMocks();
    (meService.myGoals as any).mockResolvedValue({
        data: [
            {
                id: 'g1',
                title: 'Ship employee self-service',
                description: 'Give employees their own surface',
                status: 'active',
                progress_percentage: 60,
                target_date: '2026-12-01',
            },
        ],
        total: 1,
    });
});

describe('Given an employee viewing their goals', () => {
    it('When it loads / Then their goals are listed with progress', async () => {
        render(<MyGoalsPage />);

        await waitFor(() =>
            expect(screen.getByText('Ship employee self-service')).toBeInTheDocument(),
        );
        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText(/Target: 2026-12-01/)).toBeInTheDocument();
    });

    it('When it loads / Then only the self-scoped endpoint is used', async () => {
        render(<MyGoalsPage />);
        await waitFor(() => expect(meService.myGoals).toHaveBeenCalled());

        // No person_id argument exists on the self-service client.
        expect((meService.myGoals as any).mock.calls[0][0]).toBeUndefined();
    });

    it('When progress is absent / Then it reads as zero rather than blank', async () => {
        (meService.myGoals as any).mockResolvedValue({
            data: [{ id: 'g2', title: 'No progress yet', status: 'draft', target_date: '2026-12-01' }],
            total: 1,
        });

        render(<MyGoalsPage />);
        await waitFor(() => expect(screen.getByText('0%')).toBeInTheDocument());
    });

    it('When there are no goals / Then an empty state explains why', async () => {
        (meService.myGoals as any).mockResolvedValue({ data: [], total: 0 });
        render(<MyGoalsPage />);

        await waitFor(() => expect(screen.getByText(/No goals yet/i)).toBeInTheDocument());
    });

    it('When the request fails / Then the page degrades to empty rather than crashing', async () => {
        (meService.myGoals as any).mockRejectedValue(new Error('down'));
        render(<MyGoalsPage />);

        await waitFor(() => expect(screen.getByText(/No goals yet/i)).toBeInTheDocument());
    });
});

describe('Given the page is deliberately read-only', () => {
    it('When it renders / Then it offers no way to write a goal', async () => {
        render(<MyGoalsPage />);
        await waitFor(() =>
            expect(screen.getByText('Ship employee self-service')).toBeInTheDocument(),
        );

        expect(screen.queryByRole('button', { name: /add|new|create|update|edit/i })).toBeNull();
    });
});
