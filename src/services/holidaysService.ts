import { api } from './apiClient';

export interface Holiday {
  id: string;
  org_id: string;
  tenant_id: string;
  name: string;
  holiday_date: string;
  state?: string | null;
  country?: string | null;
  region?: string | null;
  is_optional: boolean;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateHolidayPayload {
  name: string;
  holiday_date: string;
  state?: string;
  country?: string;
  region?: string;
  is_optional?: boolean;
  is_mandatory?: boolean;
}

export interface HolidayFilters {
  year?: string;
  from_date?: string;
  to_date?: string;
  [key: string]: string | undefined;
}

export const holidaysApi = {
  getAll: async (filters: HolidayFilters = {}): Promise<{ data: Holiday[] }> => {
    return api.get<{ data: Holiday[] }>('/holidays', filters);
  },

  create: async (data: CreateHolidayPayload): Promise<Holiday> => {
    return api.post<Holiday>('/holidays', data);
  },

  update: async (id: string, data: Partial<CreateHolidayPayload>): Promise<Holiday> => {
    return api.patch<Holiday>(`/holidays/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/holidays/${id}`);
  },
};
