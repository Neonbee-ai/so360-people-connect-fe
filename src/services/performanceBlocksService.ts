import { api } from './apiClient';

/**
 * Performance evidence pushed in by measuring modules (today: CRM sales
 * reviews).
 *
 * A block is an immutable snapshot of what a person's numbers were when their
 * review was finalized — deliberately NOT a live read. An appraisal opened six
 * months later must show what was true at the time; a rep whose pipeline has
 * since collapsed did not retroactively have a bad August.
 */

export interface PerformanceBlockPayload {
  results?: {
    headline?: { metric?: string; attainment?: number | null } | null;
    metrics?: Array<{
      metric?: string;
      unit?: string;
      actual?: number;
      target?: number;
      attainment?: number | null;
    }>;
  };
  pipeline?: {
    applicable?: boolean;
    total_pipeline?: number | null;
    coverage?: number | null;
  };
  win_loss?: {
    won_count?: number;
    lost_count?: number;
    top_reason?: { label?: string } | null;
  };
  wins?: string | null;
  losses?: string | null;
  notes?: string | null;
  action_items?: Array<{ kind?: string; text?: string }>;
  crm_review_id?: string;
}

export interface PerformanceBlock {
  id: string;
  person_id: string;
  source: string;
  period_type: 'monthly' | 'quarterly' | 'annual';
  period_start: string;
  period_end: string;
  payload: PerformanceBlockPayload;
  /** When the SOURCE computed the numbers — not when the row was written. */
  computed_at: string;
  linked_review_id?: string | null;
  created_at: string;
}

export const performanceBlocksApi = {
  /**
   * Evidence for a person, newest first.
   *
   * Passing a window filters by OVERLAP on the server: a monthly sales review
   * sits inside a quarterly appraisal window and a quarterly one straddles it,
   * so containment would hide the evidence being looked for.
   */
  list: (
    personId: string,
    opts?: { limit?: number; period_start?: string; period_end?: string },
  ) =>
    api.get<PerformanceBlock[]>(
      `/performance-blocks/${personId}`,
      opts as Record<string, unknown> | undefined,
    ),
};
