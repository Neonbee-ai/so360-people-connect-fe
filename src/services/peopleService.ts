import type {
  Person,
  CreatePersonPayload,
  PersonRole,
  Allocation,
  CreateAllocationPayload,
  UpdateAllocationPayload,
  UtilizationData,
  UtilizationSummary,
  PeopleEvent,
  PaginatedResponse,
  EntityOption,
  LookupEntityType,
} from '../types/people';
import { api, apiContext } from './apiClient';
import { createRequestCache } from './requestCache';

// Utilization summary is org-static for short windows but is requested by both
// the Dashboard and the Utilization page (and on every revisit). Coalesce
// concurrent calls and serve a brief TTL so navigating between those pages does
// not re-hit /utilization/summary each time.
export const utilizationCache = createRequestCache({ defaultTtlMs: 15_000, maxEntries: 10 });

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

  getMe: async (): Promise<Person> => {
    return api.get<Person>('/people/me');
  },

  create: async (data: CreatePersonPayload): Promise<Person> => {
    return api.post<Person>('/people', data);
  },

  update: async (id: string, data: Partial<Person>): Promise<Person> => {
    return api.patch<Person>(`/people/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string; hard_deleted: boolean }> => {
    return api.delete<{ message: string; hard_deleted: boolean }>(`/people/${id}`);
  },

  cancelInvite: async (id: string): Promise<{ message: string }> => {
    return api.post<{ message: string }>(`/people/${id}/cancel-invite`, {});
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

  inviteUser: async (personId: string, email: string, role: string, sendEmail = true): Promise<InviteResult> => {
    return api.post<InviteResult>(`/people/${personId}/invite-user`, { email, role, send_email: sendEmail });
  },

  // Update the person's existing Core IAM org-membership role (the System Role —
  // single source of truth). Keeps the profile, Team Management, and permissions
  // in sync without creating a separate role record.
  updateSystemRole: async (personId: string, roleId: string): Promise<{ role_id: string }> => {
    return api.patch<{ role_id: string }>(`/people/${personId}/system-role`, { role_id: roleId });
  },
};

// Result of inviting a person: the copyable invite link (for manual sharing when email is
// unreliable), whether Core also emailed it, and the resulting linkage status.
export interface InviteResult {
  invite_link: string | null;
  invite_status: 'link_generated' | 'existing_user';
  user_id: string | null;
  email_sent: boolean;
  message?: string;
}

// =============================================================================
// ALLOCATIONS API
// =============================================================================

export const allocationsApi = {
  getAll: async (params?: { person_id?: string; entity_id?: string; entity_type?: string; status?: string; department_id?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Allocation>> => {
    return api.get<PaginatedResponse<Allocation>>('/allocations', params);
  },

  getById: async (id: string): Promise<Allocation> => {
    return api.get<Allocation>(`/allocations/${id}`);
  },

  create: async (data: CreateAllocationPayload): Promise<Allocation> => {
    return api.post<Allocation>('/allocations', data);
  },

  update: async (id: string, data: UpdateAllocationPayload): Promise<Allocation> => {
    return api.patch<Allocation>(`/allocations/${id}`, data);
  },

  cancel: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/allocations/${id}`);
  },
};

// =============================================================================
// TIME ENTRIES — REMOVED
// All time logging is consolidated into the Timesheets module. People Connect
// only consumes timesheet data read-only via `timesheetApi` (./timesheetApi).
// =============================================================================

// =============================================================================
// ENTITIES API (cross-service execution entity lookup)
// =============================================================================

export const entitiesApi = {
  // Returns UUID-keyed options for the requested entity type. For `task`,
  // project_id is required (tasks are listed per project).
  list: async (params: { type: LookupEntityType; search?: string; project_id?: string }): Promise<{ data: EntityOption[] }> => {
    return api.get<{ data: EntityOption[] }>('/entities', params as Record<string, unknown>);
  },
};

// =============================================================================
// UTILIZATION API
// =============================================================================

// The backend returns a flat per-person row (person_id, person_name, logged_hours,
// cost, variance as percentage points, ...) — see utilization.service.ts. The UI
// (UtilizationPage/Card/Table) is written against the nested { person, utilization }
// shape declared in types/people.ts, so raw rows are mapped here at the service
// boundary rather than reshaping the already-tested backend contract.
// Guard against missing/NaN/non-finite numbers coming from the BE so a
// single incomplete record (e.g. a person with no allocation or timesheet
// data for the period) can never propagate `undefined`/`NaN` into the UI.
const safeNum = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const mapUtilizationRow = (row: any): UtilizationData => {
  const availableHours = safeNum(row?.available_hours);
  const actualHours = safeNum(row?.logged_hours);
  const plannedHours = Math.round(availableHours * (safeNum(row?.target_utilization, 80) / 100));
  return {
    person: {
      id: row?.person_id,
      full_name: row?.person_name,
      email: row?.person_email,
      job_title: row?.job_title,
      cost_rate: row?.cost_rate,
      available_hours_per_day: row?.available_hours_per_day,
      status: row?.status,
    },
    utilization: {
      available_hours: availableHours,
      planned_hours: plannedHours,
      actual_hours: actualHours,
      actual_cost: safeNum(row?.cost),
      // Root cause of the utilization page crash: BE records with no
      // allocation/timesheet data for the period could arrive without a
      // (or with a non-numeric) utilization_pct. Always default to 0.
      utilization_pct: safeNum(row?.utilization_pct),
      allocation_pct: safeNum(row?.allocation_pct),
      variance_hours: Math.round((actualHours - plannedHours) * 10) / 10,
      is_idle: !!row?.is_idle,
      is_overallocated: !!row?.is_overallocated,
    },
  };
};

export const utilizationApi = {
  getAll: async (params?: { period_start?: string; period_end?: string; person_id?: string }): Promise<{ data: UtilizationData[]; period: { start: string; end: string } }> => {
    const raw = await api.get<{ data: any[]; period: { start: string; end: string } }>('/utilization', params);
    // Filter out any null/undefined entries the BE might send before mapping
    // — a hole in the array must never reach the sort/render pipeline.
    return { data: (raw.data || []).filter(Boolean).map(mapUtilizationRow), period: raw.period };
  },

  getSummary: async (): Promise<UtilizationSummary> => {
    return utilizationCache.run(
      `utilization-summary|${apiContext.getOrgId()}`,
      () => api.get<UtilizationSummary>('/utilization/summary'),
    );
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
