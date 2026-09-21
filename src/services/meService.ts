import { api } from './apiClient';
import type { LeaveRequest, CreateLeaveRequestPayload } from './leaveRequestsService';

/**
 * Employee self-service client.
 *
 * Every call here hits `/me/*`, where the backend resolves the person from the
 * authenticated token. None of these functions takes a `person_id` — that is
 * the point. The admin endpoints (leaveRequestsService and friends) accept one
 * as a filter, which is why they can return the whole organisation.
 */

export interface MyLeaveBalance {
    id: string;
    leave_type_id: string;
    fiscal_year: number;
    opening_balance: number;
    accrued: number;
    used: number;
    pending: number;
    available: number;
    leave_type?: { id: string; code: string; name: string; color?: string };
}

export interface MyGoal {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    progress_percentage?: number;
    target_value?: number;
    current_value?: number;
    unit?: string;
    start_date?: string;
    target_date: string;
}

export interface MyAttendanceRecord {
    id: string;
    attendance_date: string;
    status: string;
    check_in?: string;
    check_out?: string;
}

/**
 * A colleague's absence as an employee is allowed to see it: that they are
 * away, and when. Deliberately carries no reason, leave type, approver or
 * attachment — see MeService.whosOut on the backend.
 */
export interface WhosOutEntry {
    person_id: string;
    full_name: string | null;
    job_title: string | null;
    department_id: string | null;
    start_date: string;
    end_date: string;
    is_half_day_start: boolean;
    is_half_day_end: boolean;
}

/** A work unit the employee is assigned to — the pickable job for clock-in. */
export interface MyAllocation {
    id: string;
    entity_type: string;
    entity_id: string;
    entity_name: string | null;
    start_date: string | null;
    end_date: string | null;
    allocation_value: number | null;
    status: string;
}

/**
 * A leave request as seen by the department HEAD. Unlike WhosOutEntry this is
 * not redacted — a head needs reason and type to decide — which is why the
 * backend only returns rows for departments where departments.head_person_id
 * is the caller, and returns [] (not 403) for everyone else.
 */
export interface TeamLeaveRequest extends Omit<LeaveRequest, 'person'> {
    person: {
        id: string;
        full_name: string | null;
        job_title: string | null;
        department_id: string | null;
        avatar_url: string | null;
    } | null;
}

export interface DirectoryEntry {
    id: string;
    full_name: string;
    job_title: string | null;
    department_id: string | null;
    email: string | null;
    avatar_url: string | null;
}

/** Fields the backend will accept from an employee about themselves. */
export interface MyProfilePatch {
    phone?: string;
    emergency_contact?: unknown;
    avatar_url?: string;
}

/** An open clock-in. `break_started_at` set means the person is on a break. */
export interface MyOpenSession {
    id: string;
    person_id: string;
    entity_type: string;
    entity_id: string;
    entity_name?: string | null;
    started_at: string;
    break_started_at?: string | null;
}

export const meService = {
    myLeaveRequests: (params?: { status?: string; limit?: number }) =>
        api.get<{ data: LeaveRequest[]; total: number }>('/me/leave/requests', params),

    /**
     * The person is set server-side from the caller's token, so the payload
     * omits person_id entirely — this is the call that replaces the old flow
     * where the browser guessed an id and the admin endpoint rejected it with
     * "No employee profile found for your account."
     */
    requestLeave: (payload: Omit<CreateLeaveRequestPayload, 'person_id'>) =>
        api.post<LeaveRequest>('/me/leave/requests', payload),

    myLeaveBalances: (fiscalYear?: number) =>
        api.get<{ data: MyLeaveBalance[] }>('/me/leave/balances',
            fiscalYear ? { fiscal_year: fiscalYear } : undefined),

    myGoals: (params?: { status?: string }) =>
        api.get<{ data: MyGoal[]; total: number }>('/me/goals', params),

    myAttendance: (params?: { from?: string; to?: string }) =>
        api.get<{ data: MyAttendanceRecord[] }>('/me/attendance', params),

    whosOut: (from: string, to: string) =>
        api.get<{ data: WhosOutEntry[] }>('/me/team/whos-out', { from, to }),

    // Manager tier — only meaningful for department heads; everyone else
    // receives an empty list and the UI hides the section.
    myTeamLeaveRequests: (params?: { status?: string; limit?: number }) =>
        api.get<{ data: TeamLeaveRequest[]; total: number }>('/me/team/leave-requests', params),

    approveTeamLeaveRequest: (id: string, decisionNotes?: string) =>
        api.post<LeaveRequest>(`/me/team/leave-requests/${id}/approve`,
            decisionNotes ? { decision_notes: decisionNotes } : {}),

    rejectTeamLeaveRequest: (id: string, rejectionReason: string) =>
        api.post<LeaveRequest>(`/me/team/leave-requests/${id}/reject`,
            { rejection_reason: rejectionReason }),

    directory: (params?: { search?: string; department_id?: string }) =>
        api.get<{ data: DirectoryEntry[] }>('/me/team/directory', params),

    updateMyProfile: (patch: MyProfilePatch) =>
        api.patch<{ updated: boolean; fields: string[] }>('/me/profile', patch),

    // Work session. The backend forces the person from the token, so none of
    // these carries a person_id even though the underlying job-sessions API
    // requires one.
    myAllocations: (all = false) =>
        api.get<{ data: MyAllocation[] }>('/me/allocations', all ? { all: 'true' } : undefined),

    myOpenSession: () =>
        api.get<{ session: MyOpenSession | null }>('/me/session'),

    clockIn: (payload: { entity_type: string; entity_id: string; entity_name?: string }) =>
        api.post<MyOpenSession>('/me/session/clock-in', payload),

    clockOut: () => api.post<MyOpenSession>('/me/session/clock-out', {}),

    startBreak: () => api.post<MyOpenSession>('/me/session/break/start', {}),

    endBreak: () => api.post<MyOpenSession>('/me/session/break/end', {}),
};
