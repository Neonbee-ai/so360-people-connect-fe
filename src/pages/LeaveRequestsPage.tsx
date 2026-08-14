import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Calendar } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast } from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { leaveRequestsApi, LeaveRequest, CreateLeaveRequestPayload, LeaveBalance } from '../services/leaveRequestsService';
import { leaveTypesApi, LeaveType } from '../services/leaveTypesService';
import { apiContext } from '../services/apiClient';
import { peopleApi } from '../services/peopleService';
import { todayIso, focusFirstInvalid } from '../utils/validation';

const LeaveRequestsPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = usePeopleFormatters();
    const canCreate = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:leave_requests:create') ?? true);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
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

    const handleCreate = async (data: CreateLeaveRequestPayload) => {
        try {
            const created = await leaveRequestsApi.create(data);
            await leaveRequestsApi.submit(created.id);
            setShowCreateModal(false);
            toast.success('Leave request submitted successfully');
            recordActivity({ eventType: 'people.leave.requested', eventCategory: 'data', description: `Leave request submitted from ${data.start_date} to ${data.end_date}`, resourceType: 'leave_request', resourceId: created.id }).catch(() => {});
            loadRequests();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to create leave request';
            toast.error(msg);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-slate-600';
            case 'pending': return 'bg-yellow-600';
            case 'approved': return 'bg-green-600';
            case 'rejected': return 'bg-red-600';
            case 'cancelled': return 'bg-slate-500';
            default: return 'bg-slate-600';
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Leave Requests"
                subtitle="View and manage leave applications"
                actions={
                    canCreate && <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        Request Leave
                    </button>
                }
            />

            {/* Filters */}
            <div className="flex items-center gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {/* Requests Table */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <EmptyState
                    icon={Calendar}
                    title="No leave requests found"
                    description="Request time off to manage your work-life balance."
                    action={canCreate ? { label: 'Request Leave', onClick: () => setShowCreateModal(true) } : undefined}
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Person</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Leave Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Start Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">End Date</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Total Days</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {requests.map(request => (
                                <tr key={request.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                                {request.person?.avatar_url ? (
                                                    <img src={request.person.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                                ) : (
                                                    <span className="text-xs font-medium text-teal-400">
                                                        {request.person?.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm text-slate-50">{request.person?.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {request.leave_type?.color && (
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: request.leave_type.color }}
                                                />
                                            )}
                                            <span className="text-sm text-slate-50">{request.leave_type?.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {formatters.formatDate(request.start_date)}
                                        {request.is_half_day_start && <span className="text-xs text-slate-500"> (Half)</span>}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {formatters.formatDate(request.end_date)}
                                        {request.is_half_day_end && <span className="text-xs text-slate-500"> (Half)</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm font-medium text-slate-50">
                                        {request.total_days}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-slate-50 ${getStatusColor(request.status)}`}>
                                            {request.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setViewingRequest(request)}
                                            className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            <CreateLeaveRequestModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />

            {/* View Modal */}
            <ViewLeaveRequestModal
                request={viewingRequest}
                onClose={() => setViewingRequest(null)}
                formatters={formatters}
            />

        </div>
    );
};

// =============================================================================
// Create Leave Request Modal
// =============================================================================

interface CreateLeaveRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateLeaveRequestPayload) => void;
}

const CreateLeaveRequestModal: React.FC<CreateLeaveRequestModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [personError, setPersonError] = useState<string | null>(null);
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
            resolveCurrentPerson();
            loadLeaveTypes();
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
        } catch {
            setPersonError('No employee profile found for your account. Please contact your administrator.');
        }
    };

    const loadLeaveTypes = async () => {
        try {
            const result = await leaveTypesApi.getAll({ is_active: true });
            setLeaveTypes(result.data);
        } catch (error) {
            console.error('Failed to load leave types:', error);
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const nextErrors = validate(formData, allowsBackdating);
        if (Object.keys(nextErrors).length > 0 || !formData.person_id) {
            setErrors(nextErrors);
            focusFirstInvalid(formRef.current, ['leave_type_id', 'start_date', 'end_date', 'reason'], nextErrors);
            return;
        }

        onCreate({
            ...formData,
            // Never send an end half-day for a one-day request.
            is_half_day_end: isSingleDay ? false : formData.is_half_day_end,
        });
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
        <Modal isOpen={isOpen} onClose={onClose} title="Request Leave">
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
                {personError && (
                    <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-sm text-red-300">
                        {personError}
                    </div>
                )}
                <div>
                    <label htmlFor="leave-type" className="block text-xs text-slate-400 mb-1">Leave Type *</label>
                    <select
                        id="leave-type"
                        data-field="leave_type_id"
                        value={formData.leave_type_id}
                        onChange={(e) => updateField('leave_type_id', e.target.value)}
                        aria-invalid={!!errors.leave_type_id}
                        className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.leave_type_id ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                    >
                        <option value="">Select leave type</option>
                        {leaveTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </select>
                    {errors.leave_type_id && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.leave_type_id}</p>}
                    {selectedBalance && (
                        <div className="mt-2 grid grid-cols-3 gap-2 p-2 bg-slate-800/50 rounded-lg text-center">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Allocated</p>
                                <p className="text-sm font-medium text-slate-200">
                                    {selectedBalance.opening_balance + selectedBalance.accrued + selectedBalance.adjusted} days
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Used</p>
                                <p className="text-sm font-medium text-slate-200">{selectedBalance.used} days</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Remaining</p>
                                <p className="text-sm font-medium text-teal-400">{selectedBalance.available} days</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="leave-start-date" className="block text-xs text-slate-400 mb-1">Start Date *</label>
                        <input
                            id="leave-start-date"
                            data-field="start_date"
                            type="date"
                            value={formData.start_date}
                            // `min` blocks calendar picking; validate() blocks typed input.
                            min={allowsBackdating ? undefined : today}
                            onChange={(e) => updateField('start_date', e.target.value)}
                            aria-invalid={!!errors.start_date}
                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.start_date ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                        />
                        {errors.start_date && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.start_date}</p>}
                        <label className="flex items-center gap-2 mt-2" title="Tick when you are only taking the second half of the first day off.">
                            <input
                                type="checkbox"
                                aria-label="Start Date – Half Day"
                                checked={formData.is_half_day_start}
                                onChange={(e) => updateField('is_half_day_start', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-xs text-slate-400">
                                {isSingleDay ? 'Half Day (this day only)' : 'Start Date – Half Day'}
                            </span>
                        </label>
                    </div>
                    <div>
                        <label htmlFor="leave-end-date" className="block text-xs text-slate-400 mb-1">End Date *</label>
                        <input
                            id="leave-end-date"
                            data-field="end_date"
                            type="date"
                            value={formData.end_date}
                            // Minimum end date tracks the chosen start date.
                            min={formData.start_date || (allowsBackdating ? undefined : today)}
                            onChange={(e) => updateField('end_date', e.target.value)}
                            aria-invalid={!!errors.end_date}
                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.end_date ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                        />
                        {errors.end_date && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.end_date}</p>}
                        {/* Hidden for single-day requests: with start == end there is
                            only one day to halve, so a second checkbox is ambiguous. */}
                        {!isSingleDay && (
                            <label className="flex items-center gap-2 mt-2" title="Tick when you are only taking the first half of the last day off.">
                                <input
                                    type="checkbox"
                                    aria-label="End Date – Half Day"
                                    checked={formData.is_half_day_end}
                                    onChange={(e) => updateField('is_half_day_end', e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-xs text-slate-400">End Date – Half Day</span>
                            </label>
                        )}
                    </div>
                </div>

                <p className="text-xs text-slate-500 -mt-2">
                    Each half-day option applies only to its own date — tick “Start Date – Half Day”
                    when you work the morning of your first day off, and “End Date – Half Day”
                    when you return for the afternoon of your last day.
                </p>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <p className="text-sm text-slate-300">
                        Total Days: <span className="text-teal-400 font-medium">{calculateTotalDays() ?? '—'}</span>
                    </p>
                    {!hasValidRange && (
                        <p className="mt-1 text-xs text-slate-500">Fix the dates above to see the total.</p>
                    )}
                </div>

                <div>
                    <label htmlFor="leave-reason" className="block text-xs text-slate-400 mb-1">Reason *</label>
                    <textarea
                        id="leave-reason"
                        data-field="reason"
                        value={formData.reason || ''}
                        onChange={(e) => updateField('reason', e.target.value)}
                        aria-invalid={!!errors.reason}
                        className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.reason ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                        rows={3}
                        placeholder="Reason for leave..."
                    />
                    {errors.reason && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.reason}</p>}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!isFormValid}
                        title={isFormValid ? undefined : 'Complete all required fields with valid dates to submit.'}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit Request
                    </button>
                </div>
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
    formatters: { formatDate: (d: string) => string };
}

const ViewLeaveRequestModal: React.FC<ViewLeaveRequestModalProps> = ({ request, onClose, formatters }) => {
    if (!request) return null;

    const statusColors: Record<string, string> = {
        draft: 'bg-slate-600',
        pending: 'bg-yellow-600',
        approved: 'bg-green-600',
        rejected: 'bg-red-600',
        cancelled: 'bg-slate-500',
    };

    return (
        <Modal isOpen={!!request} onClose={onClose} title="Leave Request Details">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Employee</p>
                        <p className="text-sm text-slate-50 font-medium">{request.person?.full_name || '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Status</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-slate-50 ${statusColors[request.status] || 'bg-slate-600'}`}>
                            {request.status}
                        </span>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Leave Type</p>
                        <div className="flex items-center gap-2">
                            {request.leave_type?.color && (
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: request.leave_type.color }} />
                            )}
                            <p className="text-sm text-slate-50">{request.leave_type?.name || '—'}</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Total Days</p>
                        <p className="text-sm text-slate-50 font-medium">{request.total_days} day{request.total_days !== 1 ? 's' : ''}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Start Date</p>
                        <p className="text-sm text-slate-50">
                            {formatters.formatDate(request.start_date)}
                            {request.is_half_day_start && <span className="text-xs text-slate-500 ml-1">(Half Day)</span>}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">End Date</p>
                        <p className="text-sm text-slate-50">
                            {formatters.formatDate(request.end_date)}
                            {request.is_half_day_end && <span className="text-xs text-slate-500 ml-1">(Half Day)</span>}
                        </p>
                    </div>
                </div>

                {request.reason && (
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Reason</p>
                        <p className="text-sm text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg p-3">{request.reason}</p>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default LeaveRequestsPage;
