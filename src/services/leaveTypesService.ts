import type { PaginatedResponse } from '../types/people';
import { api } from './apiClient';

// =============================================================================
// Leave Type Types
// =============================================================================

export interface LeaveType {
  id: string;
  org_id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  is_paid: boolean;
  requires_approval: boolean;
  requires_documentation: boolean;
  accrual_type: 'annual' | 'monthly' | 'none';
  max_days_per_year?: number;
  accrual_rate?: number;
  carry_forward_allowed: boolean;
  max_carry_forward_days?: number;
  notice_period_days?: number;
  /**
   * Org policy switch: when true this leave type may be requested for dates in
   * the past (e.g. sick leave recorded after the fact). Defaults to false, so
   * the request form blocks past start dates unless it is explicitly enabled.
   */
  allow_backdated_requests?: boolean;
  color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface CreateLeaveTypePayload {
  code: string;
  name: string;
  description?: string;
  is_paid?: boolean;
  requires_approval?: boolean;
  requires_documentation?: boolean;
  accrual_type?: 'annual' | 'monthly' | 'none';
  max_days_per_year?: number;
  accrual_rate?: number;
  carry_forward_allowed?: boolean;
  max_carry_forward_days?: number;
  notice_period_days?: number;
  color?: string;
  is_active?: boolean;
}

// =============================================================================
// LEAVE TYPES API
// =============================================================================

export const leaveTypesApi = {
  getAll: async (params?: { is_active?: boolean; page?: number; limit?: number }): Promise<PaginatedResponse<LeaveType>> => {
    return api.get<PaginatedResponse<LeaveType>>('/leave-types', params);
  },

  getById: async (id: string): Promise<LeaveType> => {
    return api.get<LeaveType>(`/leave-types/${id}`);
  },

  create: async (data: CreateLeaveTypePayload): Promise<LeaveType> => {
    return api.post<LeaveType>('/leave-types', data);
  },

  update: async (id: string, data: Partial<LeaveType>): Promise<LeaveType> => {
    return api.patch<LeaveType>(`/leave-types/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/leave-types/${id}`);
  },
};
