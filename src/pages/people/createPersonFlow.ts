import type { CreatePersonPayload, CreatePersonInviteStatus } from '../../types/people';
import type { PendingLeaveOverride } from '../../components/leave/PersonLeaveConfigSection';

/**
 * Add Person is ONE request: the person, its custom field values and its
 * leave overrides are sent together so the backend can save or roll back
 * atomically (Pulse 311fec84). The invite is a best-effort step the backend
 * runs afterwards and reports in `invite`.
 */
export function buildAtomicCreatePayload(data: CreatePersonPayload): CreatePersonPayload {
    const { customFieldValues, leaveOverrides, ...rest } = data as CreatePersonPayload & {
        customFieldValues?: Record<string, unknown>;
        leaveOverrides?: PendingLeaveOverride[];
    };
    const payload: CreatePersonPayload = { ...rest };
    const entries = Object.entries(customFieldValues ?? {}).map(([field_def_id, value]) => ({ field_def_id, value }));
    if (entries.length > 0) payload.custom_fields = entries;
    if (leaveOverrides && leaveOverrides.length > 0) {
        payload.leave_override = leaveOverrides.map(o => ({ leave_type_id: o.leave_type_id, mode: o.mode }));
    }
    return payload;
}

/** Whether the invite step ran and failed (so the person exists but is not invited). */
export function inviteFailed(invite?: CreatePersonInviteStatus): boolean {
    return invite?.status === 'failed';
}
