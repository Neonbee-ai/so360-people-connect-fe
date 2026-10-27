import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const list = vi.fn();
vi.mock('../services/performanceBlocksService', () => ({ performanceBlocksApi: { list } }));

import PerformanceEvidencePanel from './PerformanceEvidencePanel';

const BLOCK = {
  id: 'b1', person_id: 'p1', source: 'crm', period_type: 'monthly',
  period_start: '2026-08-01', period_end: '2026-08-31', computed_at: '2026-08-31T05:53:35Z', created_at: '2026-08-31T05:53:35Z',
  payload: {
    results: { headline: { metric: 'Revenue', attainment: 0.82 }, metrics: [{ metric: 'Revenue', actual: 82000, target: 100000, attainment: 0.82 }] },
    win_loss: { won_count: 3, lost_count: 1, top_reason: { label: 'Price' } },
    action_items: [{ kind: 'Pricing', text: 'Revisit discount floor' }],
  },
};

beforeEach(() => {
  list.mockReset();
  list.mockResolvedValue([BLOCK]);
});

describe('Given PerformanceEvidencePanel in Comb', () => {
  it('When the request is pending / Then the loading state shows', () => {
    list.mockReturnValue(new Promise(() => {}));
    render(<PerformanceEvidencePanel personId="p1" />);
    expect(screen.getByText('Loading performance evidence…')).toBeInTheDocument();
  });

  it('When blocks load / Then the title, headline and snapshot caveat render', async () => {
    render(<PerformanceEvidencePanel personId="p1" />);
    await waitFor(() => expect(screen.getByText('Measured performance')).toBeInTheDocument());
    expect(screen.getByText(/Revenue: 82%/)).toBeInTheDocument();
    expect(screen.getByText(/As measured on 2026-08-31; not a live figure\./)).toBeInTheDocument();
  });

  it('When a review period is given / Then it is sent to the API and the toggle widens it', async () => {
    render(<PerformanceEvidencePanel personId="p1" periodStart="2026-08-01" periodEnd="2026-08-31" />);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(list.mock.calls[0][1]).toEqual({ period_start: '2026-08-01', period_end: '2026-08-31' });
    fireEvent.click(await screen.findByRole('button', { name: 'Show all periods' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list.mock.calls[1][1]).toEqual({});
  });

  it('When no blocks exist in a period / Then the finalized-review empty message shows', async () => {
    list.mockResolvedValue([]);
    render(<PerformanceEvidencePanel personId="p1" periodStart="2026-08-01" periodEnd="2026-08-31" />);
    expect(await screen.findByText(/finalized/i)).toBeInTheDocument();
  });

  it('When the API fails / Then the error is shown without crashing', async () => {
    list.mockRejectedValue(new Error('403 Forbidden'));
    render(<PerformanceEvidencePanel personId="p1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('403 Forbidden');
  });
});
