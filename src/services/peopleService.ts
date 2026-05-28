import type {
  Person,
  CreatePersonPayload,
  PersonRole,
  Allocation,
  CreateAllocationPayload,
  TimeEntry,
  CreateTimeEntryPayload,
  UtilizationData,
  UtilizationSummary,
  PeopleEvent,
  PaginatedResponse,
} from '../types/people';
import { api, apiContext } from './apiClient';

// =============================================================================
// PEOPLE API
// =============================================================================

export const peopleApi = {
  getAll: async (params?: {
    status?: string;
    type?: string;
    search?: string;
    department_id?: string;
    employment_type?: string;
    date_of_joining_from?: string;
    date_of_joining_to?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Person>> => {
    return api.get<PaginatedResponse<Person>>('/people', params);
  },

  getById: async (id: string): Promise<Person> => {
    return api.get<Person>(`/people/${id}`);
  },

  create: async (data: CreatePersonPayload): Promise<Person> => {
    return api.post<Person>('/people', data);
  },

  update: async (id: string, data: Partial<Person>): Promise<Person> => {
    return api.patch<Person>(`/people/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/people/${id}`);
  },

  // Roles
  addRole: async (personId: string, role: Omit<PersonRole, 'id' | 'person_id' | 'org_id' | 'tenant_id' | 'created_at'>): Promise<PersonRole> => {
    return api.post<PersonRole>(`/people/${personId}/roles`, role);
  },

  removeRole: async (personId: string, roleId: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/people/${personId}/roles/${roleId}`);
  },

  // Export
  export: async (format: 'csv' | 'excel', filters?: Record<string, any>): Promise<Blob> => {
    const queryString = filters
      ? '?' + new URLSearchParams(
          Object.entries(filters).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              acc[key] = String(value);
            }
            return acc;
          }, {} as Record<string, string>)
        ).toString()
      : '';

    const response = await fetch(`${apiContext.getBaseUrl()}/people/export?format=${format}${queryString ? '&' + queryString.slice(1) : ''}`, {
      method: 'GET',
      headers: api.getHeadersRaw(),
    });

    if (!response.ok) {
      throw new Error('Failed to export people');
    }

    return response.blob();
  },

  // Import
  import: async (file: File): Promise<{ success: number; errors: Array<{ row: number; field: string; message: string }> }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${apiContext.getBaseUrl()}/people/import`, {
      method: 'POST',
      headers: api.getHeadersRaw(),
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = `Import failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(text);
        errorMessage = errorJson.message || errorMessage;
      } catch { /* ignore */ }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  // Import Template
  getImportTemplate: async (): Promise<Blob> => {
    const response = await fetch(`${apiContext.getBaseUrl()}/people/import/template`, {
      method: 'GET',
      headers: api.getHeadersRaw(),
    });

    if (!response.ok) {
      throw new Error('Failed to download import template');
    }

    return response.blob();
  },

  // Validate Import
  validateImport: async (file: File): Promise<{ valid: boolean; errors: Array<{ row: number; field: string; message: string }> }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${apiContext.getBaseUrl()}/people/import/validate`, {
      method: 'POST',
      headers: api.getHeadersRaw(),
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = `Validation failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(text);
        errorMessage = errorJson.message || errorMessage;
      } catch { /* ignore */ }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  // Employment History
  getEmploymentHistory: async (personId: string): Promise<any[]> => {
    return api.get<any[]>(`/people/${personId}/employment-history`);
  },

  // Rate History
  getRateHistory: async (personId: string): Promise<any[]> => {
    return api.get<any[]>(`/people/${personId}/rate-history`);
  },

  // User Linkage
  linkUser: async (personId: string, userId: string): Promise<Person> => {
    return api.post<Person>(`/people/${personId}/link-user`, { user_id: userId });
  },

  getOrgRoles: async (): Promise<{ data: Array<{ id: string; name: string; description: string }> }> => {
    return api.get('/people/system/org-roles');
  },

  inviteUser: async (personId: string, email: string, role: string): Promise<Person> => {
    return api.post<Person>(`/people/${personId}/invite-user`, { email, role });
  },
};

// =============================================================================
// ALLOCATIONS API
// =============================================================================

export const allocationsApi = {
  getAll: async (params?: { person_id?: string; entity_id?: string; entity_type?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Allocation>> => {
    return api.get<PaginatedResponse<Allocation>>('/allocations', params);
  },

  getById: async (id: string): Promise<Allocation> => {
    return api.get<Allocation>(`/allocations/${id}`);
  },

  create: async (data: CreateAllocationPayload): Promise<Allocation> => {
    return api.post<Allocation>('/allocations', data);
  },

  update: async (id: string, data: Partial<Allocation>): Promise<Allocation> => {
    return api.patch<Allocation>(`/allocations/${id}`, data);
  },

  cancel: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/allocations/${id}`);
  },
};

// =============================================================================
// TIME ENTRIES API
// =============================================================================

export const timeEntriesApi = {
  getAll: async (params?: { person_id?: string; entity_id?: string; status?: string; from_date?: string; to_date?: string; page?: number; limit?: number }): Promise<PaginatedResponse<TimeEntry>> => {
    return api.get<PaginatedResponse<TimeEntry>>('/time-entries', params);
  },

  create: async (data: CreateTimeEntryPayload): Promise<TimeEntry> => {
    return api.post<TimeEntry>('/time-entries', data);
  },

  update: async (id: string, data: Partial<TimeEntry>): Promise<TimeEntry> => {
    return api.patch<TimeEntry>(`/time-entries/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/time-entries/${id}`);
  },

  submit: async (id: string): Promise<TimeEntry> => {
    return api.post<TimeEntry>(`/time-entries/${id}/submit`, {});
  },

  approve: async (id: string): Promise<TimeEntry> => {
    return api.post<TimeEntry>(`/time-entries/${id}/approve`, {});
  },

  reject: async (id: string, reason: string): Promise<TimeEntry> => {
    return api.post<TimeEntry>(`/time-entries/${id}/reject`, { reason });
  },
};

// =============================================================================
// UTILIZATION API
// =============================================================================

export const utilizationApi = {
  getAll: async (params?: { period_start?: string; period_end?: string; person_id?: string }): Promise<{ data: UtilizationData[]; period: { start: string; end: string } }> => {
    return api.get('/utilization', params);
  },

  getSummary: async (): Promise<UtilizationSummary> => {
    return api.get<UtilizationSummary>('/utilization/summary');
  },
};

// =============================================================================
// EVENTS API
// =============================================================================

export const eventsApi = {
  getAll: async (params?: { person_id?: string; event_type?: string; page?: number; limit?: number }): Promise<PaginatedResponse<PeopleEvent>> => {
    return api.get<PaginatedResponse<PeopleEvent>>('/events', params);
  },
};

// =============================================================================
// SERVICE CONFIGURATION (Called from Shell Context sync)
// Re-export apiContext as peopleService for backward compatibility
// =============================================================================

export const peopleService = apiContext;
