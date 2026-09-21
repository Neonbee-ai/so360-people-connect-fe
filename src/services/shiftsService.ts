import { api } from './apiClient';

export interface Shift {
  id: string;
  org_id: string;
  tenant_id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  break_duration_minutes: number;
  is_night_shift: boolean;
  weekly_off_pattern?: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateShiftPayload {
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes?: number;
  break_duration_minutes?: number;
  is_night_shift?: boolean;
  weekly_off_pattern?: Record<string, unknown>;
  is_active?: boolean;
}

export const shiftsApi = {
  getAll: async (): Promise<{ data: Shift[] }> => {
    return api.get<{ data: Shift[] }>('/shifts');
  },

  create: async (data: CreateShiftPayload): Promise<Shift> => {
    return api.post<Shift>('/shifts', data);
  },

  update: async (id: string, data: Partial<CreateShiftPayload>): Promise<Shift> => {
    return api.patch<Shift>(`/shifts/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/shifts/${id}`);
  },
};
