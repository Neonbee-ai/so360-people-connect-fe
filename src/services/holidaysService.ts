import { api } from './apiClient';

export type HolidayType = 'national' | 'company' | 'regional' | 'optional' | 'custom';

export interface Holiday {
  id: string;
  org_id: string;
  tenant_id: string;
  name: string;
  holiday_date: string;
  holiday_type: HolidayType;
  state?: string | null;
  country?: string | null;
  region?: string | null;
  is_optional: boolean;
  is_mandatory: boolean;
  work_location_id?: string | null;
  employment_type_master_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHolidayPayload {
  name: string;
  holiday_date: string;
  holiday_type: HolidayType;
  state?: string;
  country?: string;
  region?: string;
  is_optional?: boolean;
  is_mandatory?: boolean;
  work_location_id?: string | null;
  employment_type_master_id?: string | null;
}

export interface HolidayFilters {
  year?: string;
  from_date?: string;
  to_date?: string;
  holiday_type?: string;
  work_location_id?: string;
  employment_type_master_id?: string;
  [key: string]: string | undefined;
}

export interface CopyHolidaysResult {
  created: number;
  skipped: number;
  created_holidays: Holiday[];
  skipped_holidays: Array<{ name: string; holiday_date: string; reason: string }>;
}

export interface ResolveHolidayResult {
  is_holiday: boolean;
  holiday?: Holiday;
}

export interface ResolveHolidayParams {
  date: string;
  person_id?: string;
  work_location_id?: string;
  employment_type_master_id?: string;
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

  copyPreviousYear: async (from_year: number, to_year: number): Promise<CopyHolidaysResult> => {
    return api.post<CopyHolidaysResult>('/holidays/copy', { from_year, to_year });
  },

  resolveHoliday: async (params: ResolveHolidayParams): Promise<ResolveHolidayResult> => {
    return api.get<ResolveHolidayResult>('/holidays/resolve', params);
  },
};
