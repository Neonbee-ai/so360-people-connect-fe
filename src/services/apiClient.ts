// =============================================================================
// Shared API Client — Single source of truth for tenant/org/user context
// All service modules import this instead of duplicating ApiClient.
// =============================================================================

const _win = typeof window !== 'undefined' ? (window as any) : undefined;
const API_BASE_URL = (_win && _win.VITE_SO360_PEOPLE_API) || (import.meta as any).env?.VITE_SO360_PEOPLE_API || '/people-api';
let TENANT_ID = '';
let ORG_ID = '';
let USER_ID = '';
let USER_NAME = '';
let ACCESS_TOKEN = '';
// Optional live source for the access token. Supabase JWTs are short-lived and
// rotated by the shell; caching a single token caused stale-token 401s
// ("Invalid or expired token") on requests made after a refresh. When a
// provider is registered we resolve the freshest token on every request.
let ACCESS_TOKEN_PROVIDER: (() => string | undefined | null) | null = null;

function resolveAccessToken(): string {
  if (ACCESS_TOKEN_PROVIDER) {
    const fresh = ACCESS_TOKEN_PROVIDER();
    if (fresh) return fresh;
  }
  return ACCESS_TOKEN;
}

export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getHeaders(): HeadersInit {
    const token = resolveAccessToken();
    return {
      'Content-Type': 'application/json',
      'X-Tenant-Id': TENANT_ID,
      'X-Org-Id': ORG_ID,
      'X-User-Id': USER_ID,
      'X-User-Name': USER_NAME,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  getHeadersRaw(): Record<string, string> {
    const token = resolveAccessToken();
    return {
      'X-Tenant-Id': TENANT_ID,
      'X-Org-Id': ORG_ID,
      'X-User-Id': USER_ID,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

// Singleton shared client instance
export const api = new ApiClient(API_BASE_URL);

// =============================================================================
// Shared context setters — called once from App.tsx PeopleShellInitializer
// =============================================================================

export const apiContext = {
  setTenantId: (id: string) => { TENANT_ID = id; },
  setOrgId: (id: string) => { ORG_ID = id; },
  setUserId: (id: string) => { USER_ID = id; },
  setUserName: (name: string) => { USER_NAME = name; },
  setAccessToken: (token: string) => { ACCESS_TOKEN = token; },

  // Register a live token source so every request uses the freshest JWT even
  // after the shell rotates it. Pass null to clear.
  setAccessTokenProvider: (provider: (() => string | undefined | null) | null) => { ACCESS_TOKEN_PROVIDER = provider; },

  setUser: (user: { id: string; email: string; full_name?: string; name?: string }) => {
    USER_ID = user.id;
    USER_NAME = user.full_name || user.name || user.email;
  },

  getBaseUrl: () => API_BASE_URL,
  getTenantId: () => TENANT_ID,
  getOrgId: () => ORG_ID,
  getUserId: () => USER_ID,
  getAccessToken: () => ACCESS_TOKEN,
};
