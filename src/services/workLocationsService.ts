import { api } from './apiClient';

export type LocationType = 'factory' | 'store' | 'office' | 'remote';

export interface WorkLocation {
  id: string;
  org_id: string;
  tenant_id: string;
  name: string;
  location_type: LocationType;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkLocationPayload {
  name: string;
  location_type: LocationType;
  address?: string;
  is_active?: boolean;
}

export const workLocationsApi = {
  /**
   * `includeInactive` is for the Work Locations management page only — it needs
   * to see deactivated locations in order to edit or reactivate them. Every
   * assignment surface (Add/Edit Person) must leave it off so inactive
   * locations can never be assigned.
   */
  getAll: async (includeInactive = false): Promise<{ data: WorkLocation[] }> => {
    return api.get<{ data: WorkLocation[] }>(
      includeInactive ? '/locations?include_inactive=true' : '/locations'
    );
  },

  create: async (data: CreateWorkLocationPayload): Promise<WorkLocation> => {
    return api.post<WorkLocation>('/locations', data);
  },

  update: async (id: string, data: Partial<CreateWorkLocationPayload>): Promise<WorkLocation> => {
    return api.patch<WorkLocation>(`/locations/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/locations/${id}`);
  },
};
