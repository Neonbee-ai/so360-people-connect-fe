import type { PaginatedResponse } from '../types/people';
import { api } from './apiClient';

// =============================================================================
// Review Template Types
// =============================================================================

export interface ReviewTemplateField {
  type: 'rating' | 'textarea' | 'text' | 'number' | 'checkbox';
  label: string;
  max?: number; // for rating type
  required?: boolean;
}

export interface ReviewTemplateSection {
  id: string;
  title: string;
  description?: string;
  weight?: number; // percentage weight for overall score
  fields: ReviewTemplateField[];
}

export interface ReviewTemplate {
  id: string;
  org_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  review_type: 'annual' | 'quarterly' | 'probation' | 'project_end' | 'custom';
  rating_scale: number; // 3, 5, 10, 100
  rating_labels?: Record<string, string>; // JSONB: {1: "Poor", 2: "Fair", ...}
  sections: ReviewTemplateSection[]; // JSONB array
  requires_self_review: boolean;
  requires_manager_review: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface CreateReviewTemplatePayload {
  name: string;
  description?: string;
  review_type: 'annual' | 'quarterly' | 'probation' | 'project_end' | 'custom';
  rating_scale?: number;
  rating_labels?: Record<string, string>;
  sections: ReviewTemplateSection[];
  requires_self_review?: boolean;
  requires_manager_review?: boolean;
  is_active?: boolean;
}

// =============================================================================
// REVIEW TEMPLATES API
// =============================================================================

export const reviewTemplatesApi = {
  getAll: async (params?: { status?: string; review_type?: string; page?: number; limit?: number }): Promise<PaginatedResponse<ReviewTemplate>> => {
    return api.get<PaginatedResponse<ReviewTemplate>>('/review-templates', params);
  },

  getById: async (id: string): Promise<ReviewTemplate> => {
    return api.get<ReviewTemplate>(`/review-templates/${id}`);
  },

  create: async (data: CreateReviewTemplatePayload): Promise<ReviewTemplate> => {
    return api.post<ReviewTemplate>('/review-templates', data);
  },

  update: async (id: string, data: Partial<ReviewTemplate>): Promise<ReviewTemplate> => {
    return api.patch<ReviewTemplate>(`/review-templates/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/review-templates/${id}`);
  },

  clone: async (id: string, newName: string): Promise<ReviewTemplate> => {
    return api.post<ReviewTemplate>(`/review-templates/${id}/clone`, { name: newName });
  },
};
