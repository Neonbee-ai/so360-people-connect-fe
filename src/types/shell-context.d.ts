/**
 * Type declarations for the @so360/shell-context package.
 * This is provided by the shell MFE and shared via Module Federation.
 * Auth, user, org, and tenant info are all sourced from the shell context.
 */
declare module '@so360/shell-context' {
    import { Context } from 'react';

    export interface ShellUser {
        id: string;
        email: string;
        full_name?: string;
        name?: string;
        avatar_url?: string;
        phone?: string;
        bio?: string;
    }

    export interface ShellTenant {
        id: string;
        name: string;
        role?: string;
        status?: string;
    }

    export interface ShellOrg {
        id: string;
        name: string;
        tenant_id: string;
        role_id?: string;
    }

    export interface ShellContextType {
        user: ShellUser | null;
        tenants: ShellTenant[];
        currentTenant: ShellTenant | null;
        orgs: ShellOrg[];
        currentOrg: ShellOrg | null;
        isLoading: boolean;
        error: string | null;
        refreshContext: () => Promise<void>;
        setUser: (user: ShellUser | null) => void;
        setCurrentTenant: (tenant: ShellTenant | null) => void;
        setCurrentOrg: (org: ShellOrg | null) => void;
        accessToken?: string;
    }

    export const ShellContext: Context<ShellContextType>;
}

declare module '@so360/design-system' {
    export const Button: React.FC<Record<string, unknown>>;
    export const Card: React.FC<Record<string, unknown>>;
    export const Input: React.FC<Record<string, unknown>>;
}

declare module '@so360/event-bus' {
    export function emit(event: string, payload: unknown): void;
    export function on(event: string, handler: (payload: unknown) => void): () => void;
    export function off(event: string, handler: (payload: unknown) => void): void;
}
