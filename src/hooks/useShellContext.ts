import { useContext } from 'react';
import { ShellContext } from '@so360/shell-context';

/**
 * Hook to access the shell context within the People Connect MFE.
 * Provides access to:
 * - user: Current authenticated user (id, email, full_name, avatar_url)
 * - currentTenant: Active tenant context (id, name)
 * - currentOrg: Active organization context (id, name, tenant_id)
 * - accessToken: JWT access token for API calls
 *
 * Auth, user, org, and tenant info all come from the shell context
 * as per the MFE architecture - this module never manages auth directly.
 */
export function useShellContext() {
    const context = useContext(ShellContext);

    if (!context) {
        throw new Error('useShellContext must be used within a ShellContext.Provider');
    }

    return {
        user: context.user,
        tenants: context.tenants,
        currentTenant: context.currentTenant,
        orgs: context.orgs,
        currentOrg: context.currentOrg,
        isLoading: context.isLoading,
        error: context.error,
        accessToken: context.accessToken,
        refreshContext: context.refreshContext,
    };
}

/**
 * Hook to get derived context values useful for People Connect operations.
 */
export function usePeopleContext() {
    const shell = useShellContext();

    return {
        tenantId: shell.currentTenant?.id || '',
        orgId: shell.currentOrg?.id || '',
        userId: shell.user?.id || '',
        userName: shell.user?.full_name || shell.user?.email || 'Unknown',
        userEmail: shell.user?.email || '',
        accessToken: shell.accessToken || '',
        isReady: !!(shell.currentTenant?.id && shell.currentOrg?.id),
    };
}
