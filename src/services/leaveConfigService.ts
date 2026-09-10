import { api } from './apiClient';

/**
 * Two-level leave configuration.
 *
 *   Employment Type -> default leave types
 *   Employee        -> include / exclude on top of that default
 */

export type LeaveTypeSource = 'employment_type' | 'employee' | 'org_default';

export interface ApplicableLeaveType {
    id: string;
    code: string | null;
    name: string;
    is_paid: boolean;
    accrual_type: string;
    max_days_per_year: number | null;
    color: string | null;
    source: LeaveTypeSource;
}

export interface PersonLeaveConfig {
    person_id: string;
    employment_type: string | null;
    employment_type_master_id: string | null;
    /**
     * True when the employment type has no configuration of its own, so every
     * active leave type applies. The UI must say this rather than claim the types
     * were inherited from a configuration that does not exist.
     */
    inherits_all: boolean;
    leave_types: ApplicableLeaveType[];
    /** Types explicitly withheld from this employee. */
    excluded: ApplicableLeaveType[];
}

export interface EmploymentTypeLeaveConfig {
    /** false = nothing configured = every active leave type applies. */
    configured: boolean;
    leave_types: ApplicableLeaveType[];
}

export const leaveConfigApi = {
    getForEmploymentType: async (masterId: string): Promise<EmploymentTypeLeaveConfig> =>
        api.get<EmploymentTypeLeaveConfig>(`/leave-config/employment-types/${masterId}`),

    /** Full replace. An empty array resets the type to "everything applies". */
    setForEmploymentType: async (
        masterId: string,
        leaveTypeIds: string[],
    ): Promise<EmploymentTypeLeaveConfig> =>
        api.put<EmploymentTypeLeaveConfig>(`/leave-config/employment-types/${masterId}`, {
            leave_type_ids: leaveTypeIds,
        }),

    getForPerson: async (personId: string): Promise<PersonLeaveConfig> =>
        api.get<PersonLeaveConfig>(`/leave-config/people/${personId}`),

    setPersonOverride: async (
        personId: string,
        leaveTypeId: string,
        mode: 'include' | 'exclude',
        reason?: string,
    ): Promise<PersonLeaveConfig> =>
        api.put<PersonLeaveConfig>(`/leave-config/people/${personId}/${leaveTypeId}`, {
            mode,
            reason,
        }),

    /** Return the employee to their employment type's defaults. */
    clearPersonOverride: async (
        personId: string,
        leaveTypeId: string,
    ): Promise<PersonLeaveConfig> =>
        api.delete<PersonLeaveConfig>(`/leave-config/people/${personId}/${leaveTypeId}`),

    /**
     * Leave types this employee may actually request. The Leave Request form must
     * use this, not the org-wide catalog — that offered everyone every type.
     */
    getApplicable: async (personId: string): Promise<PersonLeaveConfig> =>
        api.get<PersonLeaveConfig>(`/leave-types/applicable/${personId}`),
};
