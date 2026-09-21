import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

/**
 * BDD specs for the appraisal evidence panel.
 *
 * CRM has been pushing finalized sales reviews into `performance_blocks` for
 * a while, but every route that could read them sat behind InternalKeyGuard —
 * so the evidence arrived and was visible to nobody. The whole point of the
 * push is that an appraisal conversation stops being reconstructed from
 * memory, so "stored correctly" was never the finish line; being READ is.
 *
 * The behaviours pinned here are the ones that make the evidence trustworthy
 * rather than merely present.
 */

const { list } = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../services/performanceBlocksService', () => ({
  performanceBlocksApi: { list },
}));

import PerformanceEvidencePanel from './PerformanceEvidencePanel';

const BLOCK = {
  id: 'b-aug',
  person_id: 'p1',
  source: 'crm',
  period_type: 'monthly' as const,
  period_start: '2026-08-01',
  period_end: '2026-08-31',
  computed_at: '2026-08-31T05:53:35.743Z',
  created_at: '2026-08-31T05:53:35.743Z',
  payload: {
    results: {
      headline: { metric: 'Revenue', attainment: 0.82 },
      metrics: [
        { metric: 'Revenue', unit: 'currency', actual: 82000, target: 100000, attainment: 0.82 },
      ],
    },
    win_loss: { won_count: 3, lost_count: 1, top_reason: { label: 'Price' } },
    action_items: [{ kind: 'Pricing', text: 'Revisit discount floor' }],
  },
};

beforeEach(() => {
  list.mockReset();
  list.mockResolvedValue([BLOCK]);
});

describe('Given an appraisal with measured evidence', () => {
  it('When the panel loads / Then the period and attainment are shown', async () => {
    render(
      <PerformanceEvidencePanel
        personId="p1"
        periodStart="2026-08-01"
        periodEnd="2026-08-31"
      />,
    );

    expect(await screen.findByText(/2026-08-01/)).toBeInTheDocument();
    expect(screen.getByText(/Revenue: 82%/)).toBeInTheDocument();
  });

  it('When it loads / Then it says the figures are AS MEASURED, not live', async () => {
    // A reviewer who assumes these are today's numbers will misread a period
    // the person has since recovered from — or been let down by.
    render(
      <PerformanceEvidencePanel
        personId="p1"
        periodStart="2026-08-01"
        periodEnd="2026-08-31"
      />,
    );
    expect(
      await screen.findByText(/As measured on 2026-08-31; not a live figure\./),
    ).toBeInTheDocument();
  });

  it('When win/loss is present / Then it is shown with the top loss reason', async () => {
    render(<PerformanceEvidencePanel personId="p1" />);
    expect(await screen.findByText(/Won 3 · Lost 1/)).toBeInTheDocument();
    expect(screen.getByText(/Top loss reason: Price/)).toBeInTheDocument();
  });

  it('When the review has agreed actions / Then they are listed', async () => {
    render(<PerformanceEvidencePanel personId="p1" />);
    expect(await screen.findByText(/Revisit discount floor/)).toBeInTheDocument();
  });
});

describe('Given a review period', () => {
  it('When both bounds exist / Then the request is scoped to that window', async () => {
    render(
      <PerformanceEvidencePanel
        personId="p1"
        periodStart="2026-08-01"
        periodEnd="2026-08-31"
      />,
    );
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][1]).toMatchObject({
      period_start: '2026-08-01',
      period_end: '2026-08-31',
    });
  });

  it('When only one bound exists / Then no window is sent rather than half of one', async () => {
    // A half-applied filter would silently drop evidence.
    render(<PerformanceEvidencePanel personId="p1" periodStart="2026-08-01" />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][1]).toEqual({});
  });

  it('When the reviewer widens the view / Then the window is dropped and all periods load', async () => {
    render(
      <PerformanceEvidencePanel
        personId="p1"
        periodStart="2026-08-01"
        periodEnd="2026-08-31"
      />,
    );
    await userEvent.click(await screen.findByText('Show all periods'));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list.mock.calls[1][1]).toEqual({});
  });
});

describe('Given no evidence for the period', () => {
  it('When the panel loads / Then it explains where evidence comes from', async () => {
    // A bare "none" reads as a fault. The reviewer needs to know the CRM
    // review has to be FINALIZED before anything arrives here.
    list.mockResolvedValue([]);
    render(
      <PerformanceEvidencePanel
        personId="p1"
        periodStart="2026-08-01"
        periodEnd="2026-08-31"
      />,
    );
    expect(
      await screen.findByText(/finalized/i),
    ).toBeInTheDocument();
  });
});

describe('Given the evidence read fails', () => {
  it('When the panel loads / Then it surfaces the failure instead of implying there is none', async () => {
    // Silently rendering "no evidence" on an error would let a reviewer
    // conclude someone had no measured performance at all.
    list.mockRejectedValue(new Error('403 Forbidden'));
    render(<PerformanceEvidencePanel personId="p1" />);
    expect(await screen.findByText(/403 Forbidden/)).toBeInTheDocument();
  });
});
