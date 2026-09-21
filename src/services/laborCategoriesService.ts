import { api } from './apiClient';

/**
 * Labor categories — People Connect owned master data.
 *
 * `base_hourly_rate` of 0 is a legal value that means UNCONFIGURED: a category
 * with no rate cannot cost an employee who has no rate of their own, which the
 * Log Time precheck reports as LABOR_CATEGORY_RATE_NOT_CONFIGURED. The UI surfaces
 * that rather than pretending 0 is a price.
 */
export interface LaborCategory {
  id: string;
  org_id: string;
  tenant_id: string;
  name: string;
  code: string;
  description?: string | null;
  base_hourly_rate: number;
  overtime_multiplier: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateLaborCategoryPayload {
  name: string;
  code: string;
  description?: string;
  base_hourly_rate: number;
  overtime_multiplier?: number;
  is_active?: boolean;
}

/** `code` is intentionally absent — it is the org-unique key and cannot be renamed. */
export type UpdateLaborCategoryPayload = Partial<
  Omit<CreateLaborCategoryPayload, 'code'>
>;

export const laborCategoriesApi = {
  getAll: async (activeOnly = false): Promise<LaborCategory[]> => {
    return api.get<LaborCategory[]>(
      '/labor-categories',
      activeOnly ? { active_only: 'true' } : undefined,
    );
  },

  getById: async (id: string): Promise<LaborCategory> => {
    return api.get<LaborCategory>(`/labor-categories/${id}`);
  },

  create: async (payload: CreateLaborCategoryPayload): Promise<LaborCategory> => {
    return api.post<LaborCategory>('/labor-categories', payload);
  },

  update: async (
    id: string,
    payload: UpdateLaborCategoryPayload,
  ): Promise<LaborCategory> => {
    return api.patch<LaborCategory>(`/labor-categories/${id}`, payload);
  },

  remove: async (id: string): Promise<{ success: boolean; id: string }> => {
    return api.delete<{ success: boolean; id: string }>(`/labor-categories/${id}`);
  },
};
