// =============================================================================
// Timesheet Bridge API (READ-ONLY cross-module client)
//
// All time logging is consolidated into the Timesheets module (port 3012).
// People Connect only CONSUMES timesheet data — it never creates, edits,
// submits, or approves entries.
//
// Calls are routed through the People Connect BE's /timesheet-bridge/* proxy
// rather than directly to the Timesheet BE. This bypasses the TimesheetV2Guard
// and PermissionsGuard that previously blocked users without Timesheet V2
// feature-flagged, returning 403s on the Employee Timesheets page.
// =============================================================================

import { api } from './apiClient';

/** Batch status reflected onto each entry row by the Timesheet BE. */
export type TimesheetEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TimesheetEntry {
  id: string;
  person_id?: string | null;
  user_id?: string | null;
  entry_date: string;
  hours: number;
  description?: string | null;
  entity_type?: string | null;
  entity_name?: string | null;
  project_id?: string | null;
  is_billable?: boolean;
  calculated_cost?: number | null;
  status: TimesheetEntryStatus;
}

export interface TimesheetEntriesResponse {
  data: TimesheetEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface TimesheetUtilizationPerson {
  person_id?: string | null;
  user_id?: string | null;
  total_hours: number;
  approved_hours: number;
  submitted_hours: number;
  billable_hours: number;
  approved_cost: number;
}

export interface TimesheetUtilizationResponse {
  people: TimesheetUtilizationPerson[];
}

export const timesheetApi = {
  /** Read-only list of timesheet entries (status = batch status). */
  getEntries: async (params?: {
    person_id?: string;
    user_id?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<TimesheetEntriesResponse> => {
    return api.get<TimesheetEntriesResponse>('/timesheet-bridge/entries', params as Record<string, unknown>);
  },

  /** Per-person utilization rollup for a date range. */
  getUtilization: async (params?: {
    from_date?: string;
    to_date?: string;
    person_ids?: string;
  }): Promise<TimesheetUtilizationResponse> => {
    return api.get<TimesheetUtilizationResponse>('/timesheet-bridge/utilization', params as Record<string, unknown>);
  },
};
