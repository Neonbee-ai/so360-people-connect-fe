import { useShellBridge } from '@so360/shell-context';

/** Permission code gating who may CONFIGURE leave applicability. */
export const LEAVE_UPDATE_PERMISSION = 'leave.update';

/**
 * Can the current user change which leave types apply to an employee or an
 * employment type?
 *
 * Deliberately `leave.update`, not `leave.create`: `leave.create` is what an
 * ordinary employee holds so they can REQUEST leave, and it must never let them
 * grant themselves a leave type. The backend enforces the same split — this hook
 * only decides whether the controls are worth rendering.
 *
 * Mirrors useCanViewCompensation's bridge semantics, with one deliberate
 * difference: this fails CLOSED while permissions are still loading. Compensation
 * fails open to avoid flickering read-only data; here an open default would
 * briefly show WRITE controls to someone who cannot use them, and the resulting
 * save would 403.
 */
export function useCanConfigureLeave(): boolean {
    const shell = useShellBridge() as any;
    if (!shell?.permissionsLoaded) return false;
    return shell?.hasPermission?.(LEAVE_UPDATE_PERMISSION) ?? false;
}
