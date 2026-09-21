import type { PaginatedResponse } from '../types/people';
import { api } from './apiClient';

// =============================================================================
// Leave Request Types
// =============================================================================

export interface LeaveRequest {
  id: string;
  org_id: string;
  tenant_id: string;
  person_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  is_half_day_start: boolean;
  is_half_day_end: boolean;
  total_days: number;
  reason?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;

  // Relations
  person?: { id: string; full_name: string; avatar_url?: string; email?: string; department_id?: string; department?: string };
  leave_type?: { id: string; name: string; code: string; color?: string };
  reviewer?: { id: string; full_name: string };

  /** One row per assigned approver, ordered by approval_level. */
  approvals?: LeaveRequestApproval[];
  /** 0 when the request has no assignments (auto-approved type, or no head configured). */
  approvals_required?: number;
  approvals_completed?: number;
}

/**
 * An assigned approver's decision on a request.
 *
 * `skipped` means another approver rejected first and this one's decision is no
 * longer needed — rejection is terminal, so the remaining rows are closed out
 * rather than left looking actionable.
 */
export interface LeaveRequestApproval {
  id: string;
  leave_request_id: string;
  approver_id: string;
  approval_level: number;
  approver_role?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  notified_at?: string | null;
  responded_at?: string | null;
  decision_notes?: string | null;
  approver?: {
    id: string;
    full_name: string;
    email?: string;
    avatar_url?: string;
    job_title?: string | null;
  } | null;
}

/** A person the requester may route their leave to, with ranking hints. */
export interface EligibleApprover {
  id: string;
  full_name: string;
  email?: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
  employee_id?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  /** The resolved reporting manager — preselected in the Request Leave modal. */
  is_suggested: boolean;
  is_department_head: boolean;
}

export interface CreateLeaveRequestPayload {
  person_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  is_half_day_start?: boolean;
  is_half_day_end?: boolean;
  reason?: string;
}

export interface LeaveBalance {
  id: string;
  person_id: string;
  leave_type_id: string;
  fiscal_year: number;
  opening_balance: number;
  accrued: number;
  used: number;
  pending: number;
  adjusted: number;
  expired: number;
  available: number;
  leave_type?: { id: string; name: string; code: string; color?: string };
  person?: { id: string; full_name: string; email?: string; avatar_url?: string };
}

// =============================================================================
// LEAVE REQUESTS API
// =============================================================================

export const leaveRequestsApi = {
  getAll: async (params?: { person_id?: string; status?: string; start_date?: string; end_date?: string; from_date?: string; to_date?: string; page?: number; limit?: number }): Promise<PaginatedResponse<LeaveRequest>> => {
    return api.get<PaginatedResponse<LeaveRequest>>('/leave-requests', params);
  },

  getById: async (id: string): Promise<LeaveRequest> => {
    return api.get<LeaveRequest>(`/leave-requests/${id}`);
  },

  create: async (data: CreateLeaveRequestPayload): Promise<LeaveRequest> => {
    return api.post<LeaveRequest>('/leave-requests', data);
  },

  update: async (id: string, data: Partial<LeaveRequest>): Promise<LeaveRequest> => {
    return api.patch<LeaveRequest>(`/leave-requests/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/leave-requests/${id}`);
  },

  submit: async (id: string, approverIds?: string[]): Promise<LeaveRequest> => {
    return api.post<LeaveRequest>(`/leave-requests/${id}/submit`, approverIds?.length ? { approver_ids: approverIds } : {});
  },

  /**
   * Records THIS approver's decision. On a multi-approver request the leave is
   * not granted until every assigned approver has approved — `fully_approved`
   * is false while others are still pending, and the request stays `pending`.
   */
  approve: async (id: string): Promise<LeaveRequest & { fully_approved?: boolean }> => {
    return api.post<LeaveRequest & { fully_approved?: boolean }>(`/leave-requests/${id}/approve`, {});
  },

  reject: async (id: string, reason: string): Promise<LeaveRequest> => {
    return api.post<LeaveRequest>(`/leave-requests/${id}/reject`, { rejection_reason: reason });
  },

  /**
   * People `personId` may route a leave request to, ranked with the resolved
   * reporting manager first. Server-side search and limit — never pull the
   * whole directory into the browser.
   */
  getEligibleApprovers: async (
    personId: string,
    params?: { search?: string; limit?: number },
  ): Promise<{ data: EligibleApprover[]; total: number; suggested_approver_id: string | null }> => {
    return api.get<{ data: EligibleApprover[]; total: number; suggested_approver_id: string | null }>(
      '/leave-requests/eligible-approvers',
      { person_id: personId, ...(params?.search ? { search: params.search } : {}), ...(params?.limit ? { limit: params.limit } : {}) },
    );
  },

  getPendingApprovals: async (): Promise<PaginatedResponse<LeaveRequest>> => {
    return api.get<PaginatedResponse<LeaveRequest>>('/leave-requests/pending-approvals');
  },

  getBalances: async (personId: string): Promise<{ data: LeaveBalance[] }> => {
    return api.get<{ data: LeaveBalance[] }>('/leave-balances', { person_id: personId });
  },
};

// =============================================================================
// LEAVE BALANCES ADMIN API
// =============================================================================

export interface InitializeBalancePayload {
  person_id: string;
  fiscal_year: number;
}

export interface AdjustBalancePayload {
  person_id: string;
  leave_type_id: string;
  fiscal_year: number;
  adjustment_amount: number;
  reason?: string;
}

export const leaveBalancesApi = {
  getAll: async (params?: { person_id?: string; fiscal_year?: number }): Promise<{ data: LeaveBalance[] }> => {
    return api.get<{ data: LeaveBalance[] }>('/leave-balances', params);
  },

  initialize: async (data: InitializeBalancePayload): Promise<{ message: string; person_id: string; fiscal_year: number }> => {
    return api.post('/leave-balances/initialize', data);
  },

  adjust: async (data: AdjustBalancePayload): Promise<LeaveBalance> => {
    return api.post<LeaveBalance>('/leave-balances/adjust', data);
  },
};
