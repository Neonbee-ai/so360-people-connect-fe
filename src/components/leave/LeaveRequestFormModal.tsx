import React, { useEffect, useState, useRef } from 'react';
import { Select, Button, Modal, DateInput, Checkbox, Textarea, DescriptionList, Stack, Cluster, Alert } from '@so360/design-system';
import { leaveRequestsApi, CreateLeaveRequestPayload, LeaveBalance } from '../../services/leaveRequestsService';
import { LeaveType } from '../../services/leaveTypesService';
import { leaveConfigApi } from '../../services/leaveConfigService';
import { peopleApi } from '../../services/peopleService';
import ApproverSelector from './ApproverSelector';
import { todayIso } from '../../utils/validation';
import { minWorkingDays } from '../../utils/leaveBalance';

/**
 * The one leave request form (Pulse 78626df8).
 *
 * Admin "Leave Requests" and employee "My Leave" both open this modal, so the
 * two can no longer drift: same labels, field order, half-day options, balance
 * summary, total, approver picker and validation. Only the save differs — the
 * caller's `onCreate` decides which endpoint receives the payload — and where
 * balances come from (`loadBalances`), because employees read their own
 * balances through /me rather than the admin balances endpoint.
 */

/** The balance fields the form displays; both /leave-balances and /me shapes satisfy it. */
export type LeaveFormBalance = Pick<LeaveBalance, 'leave_type_id' | 'opening_balance' | 'accrued' | 'used' | 'available'> & {
    adjusted?: number;
};

export interface LeaveRequestFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateLeaveRequestPayload, approverIds: string[]) => void;
    submitting?: boolean;
    /** Balance source for the selected person. Defaults to the admin /leave-balances endpoint. */
    loadBalances?: (personId: string) => Promise<LeaveFormBalance[]>;
}

const defaultLoadBalances = async (personId: string): Promise<LeaveFormBalance[]> =>
    (await leaveRequestsApi.getBalances(personId)).data || [];

const LeaveRequestFormModal: React.FC<LeaveRequestFormModalProps> = ({ isOpen, onClose, onCreate, submitting = false, loadBalances: fetchBalances = defaultLoadBalances }) => {
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [leaveTypesError, setLeaveTypesError] = useState<string | null>(null);
    const [balances, setBalances] = useState<LeaveFormBalance[]>([]);
    const [personError, setPersonError] = useState<string | null>(null);
    const [approverIds, setApproverIds] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    const today = todayIso();
    const [formData, setFormData] = useState<CreateLeaveRequestPayload>({
        person_id: '',
        leave_type_id: '',
        start_date: today,
        end_date: today,
        is_half_day_start: false,
        is_half_day_end: false,
        reason: '',
    });

    useEffect(() => {
        if (isOpen) {
            setErrors({});
            setApproverIds([]);
            // Leave types are loaded per-person now (see loadApplicableLeaveTypes),
            // because which types apply depends on the employee's employment type
            // and their own overrides. resolveCurrentPerson triggers that load.
            resolveCurrentPerson();
        }
    }, [isOpen]);

    const resolveCurrentPerson = async () => {
        try {
            setPersonError(null);
            const person = await peopleApi.getMe();
            // Read the id eagerly: when no People profile is linked the backend
            // can resolve `undefined` (instead of rejecting). Reading `person.id`
            // inside the setFormData updater would defer the access into React's
            // reducer — outside this try — surfacing as an unhandled error.
            const personId = person?.id;
            if (!personId) {
                setPersonError('No employee profile found for your account. Please contact your administrator.');
                return;
            }
            setFormData(prev => ({ ...prev, person_id: personId }));
            loadBalances(personId);
            loadApplicableLeaveTypes(personId);
        } catch {
            setPersonError('No employee profile found for your account. Please contact your administrator.');
        }
    };

    /**
     * Only the leave types that apply to THIS employee.
     *
     * The org-wide catalog (`leaveTypesApi.getAll`) offered every employee every
     * type — Maternity, Paternity and Bereavement included — and the request was
     * then rejected on the server. Applicability comes from the employee's
     * employment type plus their own overrides; an org that has configured
     * nothing still gets every active type, so nothing changes for them.
     */
    const loadApplicableLeaveTypes = async (personId: string) => {
        try {
            const config = await leaveConfigApi.getApplicable(personId);
            setLeaveTypes(config.leave_types as unknown as LeaveType[]);
            setLeaveTypesError(null);
        } catch (error) {
            console.error('Failed to load applicable leave types:', error);
            // Fail CLOSED with a visible message rather than silently falling back
            // to the whole catalog: offering a type the server will refuse is the
            // behaviour this replaced.
            setLeaveTypes([]);
            setLeaveTypesError('Could not load the leave types available to you. Please try again.');
        }
    };

    const loadBalances = async (personId: string) => {
        try {
            setBalances(await fetchBalances(personId));
        } catch (error) {
            console.error('Failed to load leave balances:', error);
        }
    };

    const selectedLeaveType = leaveTypes.find(t => t.id === formData.leave_type_id);
    // Backdating is opt-in per leave type (e.g. sick leave recorded after the
    // fact). Everything else must start today or later.
    const allowsBackdating = selectedLeaveType?.allow_backdated_requests === true;
    // A single-day request has only one day to halve, so the end-date checkbox
    // would be ambiguous (both boxes on a 1-day request = 0 days).
    const isSingleDay = formData.start_date === formData.end_date;

    const validate = (data: CreateLeaveRequestPayload, backdatingAllowed: boolean): Record<string, string> => {
        const next: Record<string, string> = {};
        if (!data.leave_type_id) next.leave_type_id = 'Select a leave type.';
        if (!data.start_date) {
            next.start_date = 'Start date is required.';
        } else if (!backdatingAllowed && data.start_date < today) {
            next.start_date = 'Start date cannot be in the past.';
        }
        if (!data.end_date) {
            next.end_date = 'End date is required.';
        } else if (data.start_date && data.end_date < data.start_date) {
            next.end_date = 'End date cannot be earlier than start date.';
        }
        if (!data.reason || !data.reason.trim()) next.reason = 'Reason is required.';
        return next;
    };

    const validationErrors = validate(formData, allowsBackdating);
    const hasValidRange = !validationErrors.start_date && !validationErrors.end_date;
    const isFormValid = Object.keys(validationErrors).length === 0 && !!formData.person_id && !personError;

    /**
     * Working days (Mon-Fri) in the selected window, minus half-days — the same
     * basis the server charges against the balance (it also skips holidays).
     * Null for an invalid range so the UI shows "—" rather than a nonsense
     * figure. Calendar days over-counted every weekend and made the balance
     * warning block requests the server would accept.
     */
    const calculateTotalDays = (): number | null => {
        if (!hasValidRange) return null;
        return minWorkingDays(formData.start_date, formData.end_date, formData.is_half_day_start, formData.is_half_day_end);
    };

    const focusField = (field: string) => {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="leaverequests-${field}"]`);
        el?.focus?.({ preventScroll: true });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (exceedsBalance) return;
        const nextErrors = validate(formData, allowsBackdating);
        if (Object.keys(nextErrors).length > 0 || !formData.person_id) {
            setErrors(nextErrors);
            const first = ['leave_type_id', 'start_date', 'end_date', 'reason'].find(f => nextErrors[f]);
            if (first) focusField(first);
            return;
        }

        onCreate(
            {
                ...formData,
                // Never send an end half-day for a one-day request.
                is_half_day_end: isSingleDay ? false : formData.is_half_day_end,
            },
            approverIds,
        );
    };

    const updateField = (field: keyof CreateLeaveRequestPayload, value: unknown) => {
        // Functional update: `person_id` is filled in asynchronously by
        // resolveCurrentPerson, so merging into a captured `formData` snapshot
        // could wipe it out mid-flight.
        setFormData(prev => {
            const merged = { ...prev, [field]: value } as CreateLeaveRequestPayload;
            // Moving the start date past the end date drags the end date along
            // instead of leaving an invalid pair on screen.
            if (field === 'start_date' && typeof value === 'string' && merged.end_date < value) {
                merged.end_date = value;
            }
            return merged;
        });
        // Errors depend only on user-entered fields, so the local snapshot is
        // safe here.
        const nextData = { ...formData, [field]: value } as CreateLeaveRequestPayload;
        if (field === 'start_date' && typeof value === 'string' && nextData.end_date < value) {
            nextData.end_date = value;
        }
        const nextErrors = validate(nextData, allowsBackdating);
        setErrors(prev => ({
            ...prev,
            [field]: nextErrors[field] || '',
            ...(field === 'start_date' ? { end_date: nextErrors.end_date || '' } : {}),
        }));
    };

    const selectedBalance = balances.find(b => b.leave_type_id === formData.leave_type_id);
    // Over-balance requests are rejected by the server; say so up front and block
    // the submit. Leave types with accrual_type 'none' (e.g. event-based) have no
    // balance to exceed. Unknown balance never blocks — the server is authoritative.
    const requestedDays = calculateTotalDays();
    const exceedsBalance =
        !!selectedBalance &&
        selectedLeaveType?.accrual_type !== 'none' &&
        requestedDays !== null &&
        requestedDays > selectedBalance.available;

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Request Leave"
            footer={
                <Cluster gap="tight" justify="end">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        type="submit"
                        form="leave-request-form"
                        disabled={!isFormValid || exceedsBalance || submitting}
                        title={exceedsBalance ? 'Requested days exceed your available balance.' : isFormValid ? undefined : 'Complete all required fields with valid dates to submit.'}
                    >
                        {submitting ? 'Submitting…' : 'Submit Request'}
                    </Button>
                </Cluster>
            }
        >
            <form id="leave-request-form" ref={formRef} onSubmit={handleSubmit} noValidate>
                <Stack gap="default">
                    {personError && (
                        <p role="alert" className="p-nb-3 rounded-nb bg-danger-container/30 border border-danger/50 text-nb-body text-danger">
                            {personError}
                        </p>
                    )}
                    <Stack gap="tight">
                        <Select
                            name="leaverequests-leave_type_id"
                            label="Leave Type *"
                            placeholder="Select leave type"
                            value={formData.leave_type_id}
                            onChange={(e) => updateField('leave_type_id', e.target.value)}
                            error={errors.leave_type_id || undefined}
                            options={leaveTypes.map(type => ({ value: type.id, label: type.name }))}
                        />
                        {leaveTypesError && (
                            <p role="alert" className="text-nb-caption text-danger">{leaveTypesError}</p>
                        )}
                        {/* An empty picker is a configuration answer, not a loading
                            state — say which one, or the user just sees a dead dropdown. */}
                        {!leaveTypesError && !personError && leaveTypes.length === 0 && (
                            <p className="text-nb-caption text-warning">
                                No leave types are configured for your employment type. Contact HR.
                            </p>
                        )}
                        {selectedBalance && (
                            <DescriptionList
                                columns={3}
                                items={[
                                    { label: 'Allocated', value: `${selectedBalance.opening_balance + selectedBalance.accrued + (selectedBalance.adjusted ?? 0)} days` },
                                    { label: 'Used', value: `${selectedBalance.used} days` },
                                    { label: 'Remaining', value: <span className="font-medium text-primary">{selectedBalance.available} days</span> },
                                ]}
                            />
                        )}
                        {exceedsBalance && selectedBalance && (
                            <Alert variant="warning">
                                You are requesting {requestedDays} days but only {selectedBalance.available} are available for this leave type.
                            </Alert>
                        )}
                    </Stack>

                    <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-4">
                        <Stack gap="tight">
                            <DateInput
                                name="leaverequests-start_date"
                                label="Start Date *"
                                value={formData.start_date}
                                // `min` blocks calendar picking; validate() blocks typed input.
                                min={allowsBackdating ? undefined : today}
                                onChange={(v: string) => updateField('start_date', v)}
                                error={errors.start_date || undefined}
                            />
                            <Checkbox
                                name="leaverequests-half_day_start"
                                label={isSingleDay ? 'Half Day (this day only)' : 'Start Date – Half Day'}
                                checked={formData.is_half_day_start}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('is_half_day_start', e.target.checked)}
                                title="Tick when you are only taking the second half of the first day off."
                            />
                        </Stack>
                        <Stack gap="tight">
                            <DateInput
                                name="leaverequests-end_date"
                                label="End Date *"
                                value={formData.end_date}
                                // Minimum end date tracks the chosen start date.
                                min={formData.start_date || (allowsBackdating ? undefined : today)}
                                onChange={(v: string) => updateField('end_date', v)}
                                error={errors.end_date || undefined}
                            />
                            {/* Hidden for single-day requests: with start == end there is
                                only one day to halve, so a second checkbox is ambiguous. */}
                            {!isSingleDay && (
                                <Checkbox
                                    name="leaverequests-half_day_end"
                                    label="End Date – Half Day"
                                    checked={formData.is_half_day_end}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('is_half_day_end', e.target.checked)}
                                    title="Tick when you are only taking the first half of the last day off."
                                />
                            )}
                        </Stack>
                    </div>

                    <p className="text-nb-caption text-fg-subtle">
                        Each half-day option applies only to its own date — tick “Start Date – Half Day”
                        when you work the morning of your first day off, and “End Date – Half Day”
                        when you return for the afternoon of your last day.
                    </p>

                    <div className="bg-surface-raised/50 border border-line-strong rounded-nb p-nb-3">
                        <p className="text-nb-body text-fg">
                            Total Days: <span className="text-primary font-medium">{calculateTotalDays() ?? '—'}</span>
                        </p>
                        {!hasValidRange && (
                            <p className="mt-nb-1 text-nb-caption text-fg-subtle">Fix the dates above to see the total.</p>
                        )}
                    </div>

                    {/* Sits between Total Days and Reason — the request is fully
                        described by this point, so choosing who reviews it is the
                        natural next decision. */}
                    {formData.person_id && (
                        <ApproverSelector
                            personId={formData.person_id}
                            value={approverIds}
                            onChange={setApproverIds}
                            disabled={submitting}
                            helpText="Select the manager or approver(s) who should review this leave request. Leave blank to route to your department head."
                        />
                    )}

                    <Textarea
                        name="leaverequests-reason"
                        label="Reason *"
                        value={formData.reason || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('reason', e.target.value)}
                        error={errors.reason || undefined}
                        rows={3}
                        placeholder="Reason for leave..."
                    />
                </Stack>
            </form>
        </Modal>
    );
};

export default LeaveRequestFormModal;
