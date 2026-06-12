import type { PaginatedResponse } from '../types/people';
import { api } from './apiClient';

// =============================================================================
// Goal Types
// =============================================================================

export interface Goal {
  id: string;
  org_id: string;
  tenant_id: string;
  person_id: string;
  title: string;
  description?: string;
  goal_type: 'individual' | 'team' | 'company' | 'development';
  start_date?: string;
  target_date: string;
  measurement_criteria?: string;
  target_value?: number;
  current_value?: number;
  unit?: string; // e.g., "sales", "projects", "%"
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  progress_percentage: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;

  // Relations
  person?: { id: string; full_name: string; avatar_url?: string; job_title?: string };
}

export interface CreateGoalPayload {
  person_id: string;
  title: string;
  description?: string;
  goal_type: 'individual' | 'team' | 'company' | 'development';
  start_date?: string;
  target_date: string;
  measurement_criteria?: string;
  target_value?: number;
  current_value?: number;
  unit?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'draft' | 'in_progress' | 'completed' | 'cancelled';
}

// =============================================================================
// GOALS API
// =============================================================================

export const goalsApi = {
  getAll: async (params?: { person_id?: string; status?: string; goal_type?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Goal>> => {
    return api.get<PaginatedResponse<Goal>>('/goals', params);
  },

  getById: async (id: string): Promise<Goal> => {
    return api.get<Goal>(`/goals/${id}`);
  },

  create: async (data: CreateGoalPayload): Promise<Goal> => {
    return api.post<Goal>('/goals', data);
  },

  update: async (id: string, data: Partial<Goal>): Promise<Goal> => {
    return api.patch<Goal>(`/goals/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/goals/${id}`);
  },

  updateProgress: async (id: string, currentValue: number, targetValue?: number): Promise<Goal> => {
    const progress_percentage = targetValue && targetValue > 0
      ? Math.min(100, Math.round((currentValue / targetValue) * 100))
      : 0;
    return api.patch<Goal>(`/goals/${id}/progress`, { current_value: currentValue, progress_percentage });
  },

  complete: async (id: string): Promise<Goal> => {
    return api.post<Goal>(`/goals/${id}/complete`, {});
  },
};
