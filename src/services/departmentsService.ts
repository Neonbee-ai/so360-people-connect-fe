import type { PaginatedResponse } from '../types/people';
import { api } from './apiClient';

// =============================================================================
// Department Types
// =============================================================================

export interface Department {
  id: string;
  org_id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  parent_id?: string;
  head_person_id?: string;
  is_active: boolean;
  depth?: number;
  path?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;

  // Relations
  head_person?: { id: string; full_name: string; avatar_url?: string };
  employee_count?: number;
  children?: Department[];
}

export interface CreateDepartmentPayload {
  code: string;
  name: string;
  description?: string;
  parent_id?: string;
  head_person_id?: string;
  is_active?: boolean;
}

export interface DepartmentEmployee {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  job_title?: string;
  type?: string;
  status?: string;
  cost_rate?: number;
  billing_rate?: number;
}

export interface DepartmentEmployeesResponse {
  data: DepartmentEmployee[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

// =============================================================================
// DEPARTMENTS API
// =============================================================================

export const departmentsApi = {
  getAll: async (params?: { is_active?: boolean; page?: number; limit?: number }): Promise<PaginatedResponse<Department>> => {
    return api.get<PaginatedResponse<Department>>('/departments', params);
  },

  getTree: async (): Promise<{ data: Department[] }> => {
    return api.get<{ data: Department[] }>('/departments/tree');
  },

  getById: async (id: string): Promise<Department> => {
    return api.get<Department>(`/departments/${id}`);
  },

  getEmployees: async (id: string, params?: { page?: number; limit?: number }): Promise<DepartmentEmployeesResponse> => {
    return api.get<DepartmentEmployeesResponse>(`/departments/${id}/employees`, params);
  },

  create: async (data: CreateDepartmentPayload): Promise<Department> => {
    return api.post<Department>('/departments', data);
  },

  update: async (id: string, data: Partial<Department>): Promise<Department> => {
    return api.patch<Department>(`/departments/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/departments/${id}`);
  },
};
