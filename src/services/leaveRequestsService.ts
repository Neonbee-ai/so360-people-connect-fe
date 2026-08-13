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

  submit: async (id: string): Promise<LeaveRequest> => {
    return api.post<LeaveRequest>(`/leave-requests/${id}/submit`, {});
  },

  approve: async (id: string): Promise<LeaveRequest> => {
    return api.post<LeaveRequest>(`/leave-requests/${id}/approve`, {});
  },

  reject: async (id: string, reason: string): Promise<LeaveRequest> => {
    return api.post<LeaveRequest>(`/leave-requests/${id}/reject`, { rejection_reason: reason });
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
