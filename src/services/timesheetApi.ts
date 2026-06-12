// =============================================================================
// Timesheet API (READ-ONLY cross-module client)
//
// All time logging is consolidated into the Timesheets module (port 3012).
// People Connect only CONSUMES timesheet data — it never creates, edits,
// submits, or approves entries. This client mirrors the canonical cross-module
// base-URL pattern used by so360-timesheet-fe (window-injected env var →
// import.meta.env → localhost fallback) and reuses the shared apiClient
// context for X-Tenant-Id / X-Org-Id / Authorization headers.
// =============================================================================

import { api } from './apiClient';

const _win = typeof window !== 'undefined' ? (window as any) : undefined;

const TIMESHEET_API_BASE =
  (
    (_win && _win.VITE_SO360_TIMESHEET_API) ||
    (import.meta as any).env?.VITE_SO360_TIMESHEET_API ||
    'http://localhost:3012'
  ).replace(/\/$/, '') + '/api/v2/timesheet';

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

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = String(value);
    }
    return acc;
  }, {} as Record<string, string>);
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
  const url = `${TIMESHEET_API_BASE}${endpoint}${buildQueryString(params)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...api.getHeadersRaw(),
    },
  });

  const text = await response.text();

  if (!response.ok) {
    let errorMessage = `Timesheet API Error: ${response.status}`;
    try {
      const errorJson = JSON.parse(text);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
  }
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
    return request<TimesheetEntriesResponse>('/time-logging/entries', params);
  },

  /** Per-person utilization rollup for a date range. */
  getUtilization: async (params?: {
    from_date?: string;
    to_date?: string;
    person_ids?: string;
  }): Promise<TimesheetUtilizationResponse> => {
    return request<TimesheetUtilizationResponse>('/time-logging/utilization', params);
  },
};
