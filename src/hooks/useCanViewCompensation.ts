import { useShellBridge } from '@so360/shell-context';

/** Permission code gating employee compensation data (rates, salary). */
export const COMPENSATION_READ_PERMISSION = 'compensation.read';

/**
 * Compensation privacy tier — can the current user see rate/compensation
 * fields (cost rate, billing rate, rate history, salary revisions)?
 *
 * Mirrors the ModuleNav shell-bridge gating pattern:
 *  - Fail OPEN while `permissionsLoaded` is false (no flicker while the shell
 *    resolves permissions, and older shells without the bridge stay unchanged).
 *  - Fail CLOSED once loaded: only `compensation.read` holders see rates.
 *    Admin/Manager hold the '*' wildcard, which the shell's hasPermission
 *    resolves as granting every code.
 */
export function useCanViewCompensation(): boolean {
    const shell = useShellBridge() as any;
    if (!shell?.permissionsLoaded) return true;
    return shell?.hasPermission?.(COMPENSATION_READ_PERMISSION) ?? true;
}
