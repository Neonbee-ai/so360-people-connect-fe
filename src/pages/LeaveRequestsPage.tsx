import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Calendar } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { toast, Select, Button, Badge, Avatar, ListPageTemplate, DataTable, Modal, DateInput, Checkbox, Textarea, DescriptionList, Stack, Cluster } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { leaveRequestsApi, LeaveRequest, CreateLeaveRequestPayload, LeaveBalance } from '../services/leaveRequestsService';
import { LeaveType } from '../services/leaveTypesService';
import { leaveConfigApi } from '../services/leaveConfigService';
import { apiContext } from '../services/apiClient';
import { peopleApi } from '../services/peopleService';
import ApproverSelector from '../components/leave/ApproverSelector';
import ApprovalProgress from '../components/leave/ApprovalProgress';
import { todayIso } from '../utils/validation';

const LeaveRequestsPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = usePeopleFormatters();
    const canCreate = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:leave_requests:create') ?? true);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<LeaveRequest | null>(null);

    const loadRequests = useCallback(async () => {
        try {
            setLoading(true);
            const params: { status?: string } = {};
            if (statusFilter) params.status = statusFilter;

            const result = await leaveRequestsApi.getAll(params);
            setRequests(result.data);
        } catch (error) {
            console.error('Failed to load leave requests:', error);
            toast.error('Failed to load leave requests');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleCreate = async (data: CreateLeaveRequestPayload, approverIds: string[]) => {
        // Guards a double-click: create + submit are two calls, and a second
        // click between them produced two requests and two approval chains.
        if (submitting) return;
        setSubmitting(true);
        try {
            const created = await leaveRequestsApi.create(data);
            // Submit carries the selected approvers — without them the request
            // falls back to the department-head chain, which is exactly the
            // silent mis-routing this modal used to do on every submission.
            await leaveRequestsApi.submit(created.id, approverIds);
            setShowCreateModal(false);
            toast.success('Leave request submitted successfully');
            recordActivity({ eventType: 'people.leave.requested', eventCategory: 'data', description: `Leave request submitted from ${data.start_date} to ${data.end_date}`, resourceType: 'leave_request', resourceId: created.id }).catch(() => {});
            loadRequests();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to create leave request';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const columns: DataTableColumn<LeaveRequest>[] = [
        {
            key: 'person',
            header: 'Person',
            render: (r) => (
                <Cluster gap="tight" align="center">
                    <Avatar name={r.person?.full_name} src={r.person?.avatar_url || undefined} size="sm" />
                    <span className="text-nb-body text-fg">{r.person?.full_name}</span>
                </Cluster>
            ),
        },
        {
            key: 'leave_type',
            header: 'Leave Type',
            render: (r) => (
                <Cluster gap="tight" align="center">
                    {r.leave_type?.color && <span className="w-nb-3 h-nb-3 rounded-full" style={{ backgroundColor: r.leave_type.color }} />}
                    <span className="text-nb-body text-fg">{r.leave_type?.name}</span>
                </Cluster>
            ),
        },
        {
            key: 'start_date',
            header: 'Start Date',
            render: (r) => (
                <span className="text-fg-muted">
                    {formatters.formatDate(r.start_date)}
                    {r.is_half_day_start && <span className="text-nb-caption text-fg-subtle"> (Half)</span>}
                </span>
            ),
        },
        {
            key: 'end_date',
            header: 'End Date',
            render: (r) => (
                <span className="text-fg-muted">
                    {formatters.formatDate(r.end_date)}
                    {r.is_half_day_end && <span className="text-nb-caption text-fg-subtle"> (Half)</span>}
                </span>
            ),
        },
        { key: 'total_days', header: 'Total Days', align: 'center', render: (r) => <span className="font-medium text-fg">{r.total_days}</span> },
        { key: 'status', header: 'Status', align: 'center', render: (r) => <LeaveStatusBadge status={r.status} /> },
    ];

    return (
        <>
            <ListPageTemplate
                title="Leave Requests"
                description="View and manage leave applications"
                loading={loading}
                isEmpty={requests.length === 0 && !statusFilter}
                primaryAction={canCreate ? <Button onClick={() => setShowCreateModal(true)}>Request Leave</Button> : undefined}
                filterConfig={{
                    fields: [{
                        key: 'status', label: 'Status', type: 'select',
                        options: [{ value: 'draft', label: 'Draft' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'cancelled', label: 'Cancelled' }],
                    }],
                    values: { status: statusFilter },
                    onChange: (v: Record<string, any>) => setStatusFilter(v.status ?? ''),
                    onClear: () => setStatusFilter(''),
                }}
                isFilteredEmpty={requests.length === 0 && !!statusFilter}
                onClearFilters={() => setStatusFilter('')}
                empty={
                    <EmptyState
                        icon={Calendar}
                        title="No leave requests found"
                        description="Request time off to manage your work-life balance."
                        action={canCreate ? { label: 'Request Leave', onClick: () => setShowCreateModal(true) } : undefined}
                    />
                }
            >
                <DataTable name="leave-requests" columns={columns} rows={requests} rowKey={(r) => r.id} onRowClick={(r) => setViewingRequest(r)} />
            </ListPageTemplate>

            <CreateLeaveRequestModal
                isOpen={showCreateModal}
                submitting={submitting}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />

            <ViewLeaveRequestModal
                request={viewingRequest}
                onClose={() => setViewingRequest(null)}
                formatters={formatters}
            />
        </>
    );
};

const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
    draft: 'neutral',
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'neutral',
};

const LeaveStatusBadge: React.FC<{ status: string }> = ({ status }) => (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
);

// =============================================================================
// Create Leave Request Modal
// =============================================================================

interface CreateLeaveRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateLeaveRequestPayload, approverIds: string[]) => void;
    submitting?: boolean;
}

const CreateLeaveRequestModal: React.FC<CreateLeaveRequestModalProps> = ({ isOpen, onClose, onCreate, submitting = false }) => {
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [leaveTypesError, setLeaveTypesError] = useState<string | null>(null);
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
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
            const result = await leaveRequestsApi.getBalances(personId);
            setBalances(result.data || []);
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
     * Total days for the selected window. Returns null for an invalid range so
     * the UI shows "—" rather than a nonsense figure (the old version used
     * Math.abs, which happily reported 518 days for a reversed pair).
     */
    const calculateTotalDays = (): number | null => {
        if (!hasValidRange || !formData.start_date || !formData.end_date) return null;
        const start = new Date(`${formData.start_date}T00:00:00`);
        const end = new Date(`${formData.end_date}T00:00:00`);
        const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        let total = diffDays;
        if (formData.is_half_day_start) total -= 0.5;
        // On a single-day request only the start half-day applies.
        if (!isSingleDay && formData.is_half_day_end) total -= 0.5;

        return total;
    };

    const focusField = (field: string) => {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="leaverequests-${field}"]`);
        el?.focus?.({ preventScroll: true });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
                        disabled={!isFormValid || submitting}
                        title={isFormValid ? undefined : 'Complete all required fields with valid dates to submit.'}
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
                                    { label: 'Allocated', value: `${selectedBalance.opening_balance + selectedBalance.accrued + selectedBalance.adjusted} days` },
                                    { label: 'Used', value: `${selectedBalance.used} days` },
                                    { label: 'Remaining', value: <span className="font-medium text-primary">{selectedBalance.available} days</span> },
                                ]}
                            />
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

// =============================================================================
// View Leave Request Modal
// =============================================================================

interface ViewLeaveRequestModalProps {
    request: LeaveRequest | null;
    onClose: () => void;
    formatters: { formatDate: (d: string) => string; formatDateTime: (d: string) => string };
}

const ViewLeaveRequestModal: React.FC<ViewLeaveRequestModalProps> = ({ request, onClose, formatters }) => {
    // The list endpoint doesn't join approvals (it would be a per-row fan-out),
    // so the detail is fetched when the modal opens. The list row stays the
    // immediate render so the modal never opens blank.
    const [detail, setDetail] = useState<LeaveRequest | null>(null);

    useEffect(() => {
        if (!request) { setDetail(null); return; }
        let cancelled = false;
        leaveRequestsApi
            .getById(request.id)
            .then(full => { if (!cancelled) setDetail(full); })
            // Non-fatal: the row data already covers every field except the
            // approval chain, so a failure degrades to "no progress strip".
            .catch(() => {});
        return () => { cancelled = true; };
    }, [request?.id]);

    if (!request) return null;

    const shown = detail ?? request;

    return (
        <Modal
            open={!!request}
            onClose={onClose}
            title="Leave Request Details"
            footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
        >
            <Stack gap="default">
                <DescriptionList
                    columns={2}
                    items={[
                        { label: 'Employee', value: <span className="font-medium">{request.person?.full_name || '—'}</span> },
                        { label: 'Status', value: <LeaveStatusBadge status={request.status} /> },
                        {
                            label: 'Leave Type',
                            value: (
                                <Cluster gap="tight" align="center">
                                    {request.leave_type?.color && (
                                        <span className="w-nb-3 h-nb-3 rounded-full" style={{ backgroundColor: request.leave_type.color }} />
                                    )}
                                    <span>{request.leave_type?.name || '—'}</span>
                                </Cluster>
                            ),
                        },
                        { label: 'Total Days', value: <span className="font-medium">{request.total_days} day{request.total_days !== 1 ? 's' : ''}</span> },
                        {
                            label: 'Start Date',
                            value: (
                                <span>
                                    {formatters.formatDate(request.start_date)}
                                    {request.is_half_day_start && <span className="text-nb-caption text-fg-subtle ml-nb-1">(Half Day)</span>}
                                </span>
                            ),
                        },
                        {
                            label: 'End Date',
                            value: (
                                <span>
                                    {formatters.formatDate(request.end_date)}
                                    {request.is_half_day_end && <span className="text-nb-caption text-fg-subtle ml-nb-1">(Half Day)</span>}
                                </span>
                            ),
                        },
                    ]}
                />

                {request.reason && (
                    <DescriptionList
                        columns={1}
                        items={[{ label: 'Reason', value: <p className="bg-surface-raised/50 border border-line-strong rounded-nb p-nb-3">{request.reason}</p> }]}
                    />
                )}

                {shown.status === 'rejected' && shown.rejection_reason && (
                    <DescriptionList
                        columns={1}
                        items={[{ label: 'Rejection Reason', value: <p className="rounded-nb border border-danger/40 bg-danger-container/20 p-nb-3 text-danger">{shown.rejection_reason}</p> }]}
                    />
                )}

                <ApprovalProgress
                    approvals={shown.approvals ?? []}
                    submittedAt={shown.submitted_at}
                    submittedByName={shown.person?.full_name}
                    formatDateTime={formatters.formatDateTime}
                />
            </Stack>
        </Modal>
    );
};

export default LeaveRequestsPage;
