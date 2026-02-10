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

// =============================================================================
// API Client Configuration
// =============================================================================

const API_BASE_URL = '/people-api';
let TENANT_ID = '';
let ORG_ID = '';
let USER_ID = '';
let USER_NAME = '';
let ACCESS_TOKEN = '';

// API Client
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-Tenant-Id': TENANT_ID,
      'X-Org-Id': ORG_ID,
      'X-User-Id': USER_ID,
      'X-User-Name': USER_NAME,
      ...(ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {}),
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.getHeaders(), ...options.headers },
      });

      const text = await response.text();

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`;
        try {
          const errorJson = JSON.parse(text);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const queryString = params
      ? '?' + new URLSearchParams(
          Object.entries(params).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              acc[key] = String(value);
            }
            return acc;
          }, {} as Record<string, string>)
        ).toString()
      : '';
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

const api = new ApiClient(API_BASE_URL);

// =============================================================================
// PEOPLE API
// =============================================================================

export const peopleApi = {
  getAll: async (params?: { status?: string; type?: string; search?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Person>> => {
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
// =============================================================================

export const peopleService = {
  setTenantId: (id: string) => { TENANT_ID = id; },
  setOrgId: (id: string) => { ORG_ID = id; },
  setUserId: (id: string) => { USER_ID = id; },
  setUserName: (name: string) => { USER_NAME = name; },
  setAccessToken: (token: string) => { ACCESS_TOKEN = token; },

  setUser: (user: { id: string; email: string; full_name?: string; name?: string }) => {
    USER_ID = user.id;
    USER_NAME = user.full_name || user.name || user.email;
  },
};
