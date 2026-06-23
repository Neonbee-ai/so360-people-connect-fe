import { apiContext } from './apiClient';

const _win = typeof window !== 'undefined' ? (window as any) : undefined;
const CORE_API_BASE =
    (_win && _win.VITE_SO360_CORE_API) ||
    (import.meta as any).env?.VITE_SO360_CORE_API ||
    '/core-api';

// Fetches the org's configured base currency directly from Core BE.
// Used by forms that cannot wait for the shell's async businessSettings pre-load.
export async function fetchOrgBaseCurrency(orgId: string): Promise<string | null> {
    const token = apiContext.getAccessToken();
    const tenantId = apiContext.getTenantId();
    try {
        const res = await fetch(`${CORE_API_BASE}/v1/business-settings/${orgId}`, {
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': tenantId,
                'X-Org-Id': orgId,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data?.base_currency as string) || (data?.currency as string) || null;
    } catch {
        return null;
    }
}
