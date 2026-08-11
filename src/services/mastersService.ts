import { api } from './apiClient';

// Discriminator for the shared `people_connect_masters` table — mirrors
// MasterType in so360-people-connect-be/src/modules/masters/dto/masters.dto.ts
export type MasterType =
  | 'designation'
  | 'employment_type'
  | 'skill'
  | 'employee_status'
  | 'document_type';

export interface MasterRow {
  id: string;
  org_id: string;
  tenant_id: string;
  master_type: MasterType;
  code: string;
  name: string;
  level?: string | null;
  grade?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMasterPayload {
  name: string;
  code?: string;
  level?: string;
  grade?: string;
  is_active?: boolean;
  sort_order?: number;
}

// One generic client reused by all five master-data lists — parameterize by
// masterType instead of duplicating a service per list.
export const mastersApi = {
  getAll: async (
    masterType: MasterType,
    opts?: { includeInactive?: boolean },
  ): Promise<{ data: MasterRow[] }> => {
    const suffix = opts?.includeInactive ? '?includeInactive=true' : '';
    return api.get<{ data: MasterRow[] }>(`/masters/${masterType}${suffix}`);
  },

  create: async (
    masterType: MasterType,
    data: CreateMasterPayload,
  ): Promise<MasterRow> => {
    return api.post<MasterRow>(`/masters/${masterType}`, data);
  },

  update: async (
    masterType: MasterType,
    id: string,
    data: Partial<CreateMasterPayload>,
  ): Promise<MasterRow> => {
    return api.patch<MasterRow>(`/masters/${masterType}/${id}`, data);
  },

  delete: async (
    masterType: MasterType,
    id: string,
  ): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/masters/${masterType}/${id}`);
  },
};
