import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../../services/meService', () => ({
    meService: { myGoals: vi.fn() },
}));

import MyGoalsPage from './MyGoalsPage';
import { meService } from '../../services/meService';

const goal = { id: 'g1', title: 'Ship ESS', description: 'Self service', status: 'active', progress_percentage: 60, target_date: '2026-12-01' };

beforeEach(() => {
    vi.clearAllMocks();
    (meService.myGoals as any).mockResolvedValue({ data: [goal], total: 1 });
});

describe('Given MyGoalsPage on the Comb template', () => {
    it('When it renders / Then the My Goals heading and description show', async () => {
        render(<MyGoalsPage />);
        expect(screen.getByRole('heading', { name: 'My Goals' })).toBeInTheDocument();
        expect(screen.getByText("What you're working towards")).toBeInTheDocument();
        await waitFor(() => expect(meService.myGoals).toHaveBeenCalled());
    });

    it('When goals load / Then each goal is a card with title and target date', async () => {
        render(<MyGoalsPage />);
        await waitFor(() => expect(screen.getByText('Ship ESS')).toBeInTheDocument());
        expect(screen.getByText(/Target: 2026-12-01/)).toBeInTheDocument();
    });

    it('When a goal has progress / Then a progressbar and percentage render', async () => {
        render(<MyGoalsPage />);
        await waitFor(() => expect(screen.getByText('60%')).toBeInTheDocument());
        expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
    });

    it('When the goal status is active / Then a status badge is shown', async () => {
        render(<MyGoalsPage />);
        await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument());
    });

    it('When there are no goals / Then the empty state shows', async () => {
        (meService.myGoals as any).mockResolvedValue({ data: [], total: 0 });
        render(<MyGoalsPage />);
        await waitFor(() => expect(screen.getByText('No goals yet')).toBeInTheDocument());
    });
});
