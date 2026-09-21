import type { PaginatedResponse } from '../types/people';
import { api } from './apiClient';

// =============================================================================
// Performance Review Types
// =============================================================================

export interface PerformanceReview {
  id: string;
  org_id: string;
  tenant_id: string;
  person_id: string;
  template_id: string;
  reviewer_id: string;
  review_period_start: string;
  review_period_end: string;
  self_review_deadline?: string;
  manager_review_deadline?: string;
  status: 'draft' | 'self_review_pending' | 'manager_review_pending' | 'completed' | 'cancelled';
  self_review_data?: Record<string, unknown>; // JSONB
  manager_review_data?: Record<string, unknown>; // JSONB
  overall_rating?: number;
  self_review_submitted_at?: string;
  manager_review_submitted_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;

  // Relations
  person?: { id: string; full_name: string; avatar_url?: string; job_title?: string };
  template?: { id: string; name: string; review_type: string };
  reviewer?: { id: string; full_name: string };
}

export interface CreatePerformanceReviewPayload {
  person_id: string;
  template_id: string;
  reviewer_id: string;
  review_period_start: string;
  review_period_end: string;
  self_review_deadline?: string;
  manager_review_deadline?: string;
}

/**
 * A person who may be assigned as the reviewer for a given employee.
 * Eligibility is derived server-side from `departments.head_person_id` —
 * People Connect stores no per-person reporting manager.
 */
export interface EligibleReviewer {
  id: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  job_title?: string;
  department_id?: string;
  heads_departments: string[];
  is_direct_manager: boolean;
}

export interface EligibleReviewersResponse {
  data: EligibleReviewer[];
  direct_manager_id: string | null;
}

// =============================================================================
// PERFORMANCE REVIEWS API
// =============================================================================

export const performanceReviewsApi = {
  getEligibleReviewers: async (personId: string): Promise<EligibleReviewersResponse> => {
    return api.get<EligibleReviewersResponse>('/performance-reviews/eligible-reviewers', { person_id: personId });
  },

  getAll: async (params?: { person_id?: string; reviewer_id?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<PerformanceReview>> => {
    return api.get<PaginatedResponse<PerformanceReview>>('/performance-reviews', params);
  },

  getById: async (id: string): Promise<PerformanceReview> => {
    return api.get<PerformanceReview>(`/performance-reviews/${id}`);
  },

  create: async (data: CreatePerformanceReviewPayload): Promise<PerformanceReview> => {
    return api.post<PerformanceReview>('/performance-reviews', data);
  },

  update: async (id: string, data: Partial<PerformanceReview>): Promise<PerformanceReview> => {
    return api.patch<PerformanceReview>(`/performance-reviews/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/performance-reviews/${id}`);
  },

  getMyReviews: async (): Promise<PaginatedResponse<PerformanceReview>> => {
    return api.get<PaginatedResponse<PerformanceReview>>('/performance-reviews/my-reviews');
  },

  submitSelfReview: async (id: string, data: Record<string, unknown>): Promise<PerformanceReview> => {
    return api.post<PerformanceReview>(`/performance-reviews/${id}/submit-self-review`, { self_review_data: data });
  },

  submitManagerReview: async (id: string, data: Record<string, unknown>, overallRating?: number): Promise<PerformanceReview> => {
    return api.post<PerformanceReview>(`/performance-reviews/${id}/submit-manager-review`, {
      manager_review_data: data,
      overall_rating: overallRating,
    });
  },

  complete: async (id: string): Promise<PerformanceReview> => {
    return api.post<PerformanceReview>(`/performance-reviews/${id}/complete`, {});
  },
};
