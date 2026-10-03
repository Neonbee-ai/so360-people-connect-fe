import { apiContext } from './apiClient';
import { notifyQuotaExceeded } from './quotaExceeded';
import { coreGatewayUrl } from './coreGateway';

// Fetches the org's configured base currency directly from Core BE.
// Used by forms that cannot wait for the shell's async businessSettings pre-load.
export async function fetchOrgBaseCurrency(orgId: string): Promise<string | null> {
    const token = apiContext.getAccessToken();
    const tenantId = apiContext.getTenantId();
    try {
        const res = await fetch(coreGatewayUrl(`/v1/business-settings/${orgId}`, '/core-api'), {
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': tenantId,
                'X-Org-Id': orgId,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
        await notifyQuotaExceeded(res);
        if (!res.ok) return null;
        const data = await res.json();
        return (data?.base_currency as string) || (data?.currency as string) || null;
    } catch {
        return null;
    }
}
