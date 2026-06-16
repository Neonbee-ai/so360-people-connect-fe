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
  getAll: async (): Promise<{ data: WorkLocation[] }> => {
    return api.get<{ data: WorkLocation[] }>('/locations');
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
