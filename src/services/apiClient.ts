// =============================================================================
// Shared API Client — Single source of truth for tenant/org/user context
// All service modules import this instead of duplicating ApiClient.
import { notifyQuotaExceeded } from './quotaExceeded';
// =============================================================================

// -----------------------------------------------------------------------------
// Base URL resolution
//
// Two names for the same value exist in the wild:
//   • VITE_SO360_PEOPLE_CONNECT_API — what the production deploy workflow sets
//   • VITE_SO360_PEOPLE_API         — the legacy name this code originally read,
//                                     and the name the Shell injects on `window`
//
// Reading only one of them meant the app silently fell back to '/people-api'
// whenever the environment supplied the other. We now accept BOTH.
//
// ⚠️ Vite substitutes `import.meta.env.VITE_*` LITERALLY at build time. Every
// read below MUST be a full static member expression. Indirect access
// (`const e = import.meta.env; e[name]`), computed keys, destructuring, or
// optional chaining (`import.meta?.env`) are NOT substituted and ship undefined.
// That is why the candidate values are read statically here and only then handed
// to the (testable, pure) resolver.
// -----------------------------------------------------------------------------

export interface ApiBaseUrlCandidates {
  /** window.VITE_SO360_PEOPLE_CONNECT_API — runtime override injected by the Shell */
  windowPeopleConnectApi?: unknown;
  /** window.VITE_SO360_PEOPLE_API — legacy runtime override injected by the Shell */
  windowPeopleApi?: unknown;
  /** import.meta.env.VITE_SO360_PEOPLE_CONNECT_API — canonical build-time name */
  envPeopleConnectApi?: unknown;
  /** import.meta.env.VITE_SO360_PEOPLE_API — legacy build-time name */
  envPeopleApi?: unknown;
}

const DEFAULT_API_BASE_URL = '/people-api';

/**
 * Precedence (first non-empty string wins):
 *   1. window.VITE_SO360_PEOPLE_CONNECT_API   (runtime, canonical)
 *   2. window.VITE_SO360_PEOPLE_API           (runtime, legacy — what the Shell injects today)
 *   3. import.meta.env.VITE_SO360_PEOPLE_CONNECT_API (build-time, canonical — what the deploy sets)
 *   4. import.meta.env.VITE_SO360_PEOPLE_API         (build-time, legacy)
 *   5. '/people-api'                                  (same-origin proxy fallback)
 *
 * Runtime (window) beats build-time because the Shell knows the live
 * environment; canonical beats legacy within each tier.
 */
export function resolveApiBaseUrl(candidates: ApiBaseUrlCandidates): string {
  const ordered = [
    candidates.windowPeopleConnectApi,
    candidates.windowPeopleApi,
    candidates.envPeopleConnectApi,
    candidates.envPeopleApi,
  ];
  for (const value of ordered) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return DEFAULT_API_BASE_URL;
}

const _win = typeof window !== 'undefined' ? (window as any) : undefined;
const API_BASE_URL = resolveApiBaseUrl({
  windowPeopleConnectApi: _win && _win.VITE_SO360_PEOPLE_CONNECT_API,
  windowPeopleApi: _win && _win.VITE_SO360_PEOPLE_API,
  envPeopleConnectApi: import.meta.env.VITE_SO360_PEOPLE_CONNECT_API,
  envPeopleApi: import.meta.env.VITE_SO360_PEOPLE_API,
});
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
      await notifyQuotaExceeded(response);

      const text = await response.text();

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`;
        try {
          const errorJson = JSON.parse(text);
          // NestJS ValidationPipe returns `message` as an array of constraint
          // strings; joining keeps them readable instead of relying on Array
          // coercion, which glues them together without spaces.
          const raw = errorJson.message ?? errorJson.error;
          errorMessage = Array.isArray(raw)
            ? raw.join('; ') || errorMessage
            : raw || errorMessage;
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

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) });
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
