import { apiContext } from './apiClient';

// =============================================================================
// Department-Scoped Access — calls so360-core directly (not People Connect
// BE). The grant/revoke/list-by-department endpoints live in Core's IAM
// module since access scopes are a platform IAM concept; department_id is
// just an opaque value from People Connect's own DB. Mirrors the direct
// Core-call pattern already used by settingsService.ts's fetchOrgBaseCurrency.
// =============================================================================

const _win = typeof window !== 'undefined' ? (window as any) : undefined;
const CORE_API_BASE =
  (_win && _win.VITE_SO360_CORE_API) ||
  (import.meta as any).env?.VITE_SO360_CORE_API ||
  '/core-api';

export interface DepartmentScopeGrantee {
  id: string;
  user_id: string;
  include_descendants: boolean;
  user_email: string | null;
  user_full_name: string | null;
}

function coreHeaders(): Record<string, string> {
  const token = apiContext.getAccessToken();
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Id': apiContext.getTenantId(),
    'X-Org-Id': apiContext.getOrgId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function coreRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CORE_API_BASE}${path}`, {
    ...init,
    headers: { ...coreHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export const departmentScopeApi = {
  /** Who currently has scoped access to this department. */
  listForDepartment: async (
    orgId: string,
    departmentId: string,
  ): Promise<DepartmentScopeGrantee[]> => {
    const result = await coreRequest<{ scopes: DepartmentScopeGrantee[] }>(
      `/v1/iam/user-department-scopes/by-department/${orgId}/${departmentId}`,
    );
    return result.scopes || [];
  },

  grant: async (payload: {
    user_id: string;
    org_id: string;
    department_id: string;
    include_descendants?: boolean;
  }): Promise<void> => {
    await coreRequest('/v1/iam/user-department-scopes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  revoke: async (scopeId: string, orgId: string): Promise<void> => {
    await coreRequest(
      `/v1/iam/user-department-scopes/${scopeId}?org_id=${encodeURIComponent(orgId)}`,
      { method: 'DELETE' },
    );
  },
};
