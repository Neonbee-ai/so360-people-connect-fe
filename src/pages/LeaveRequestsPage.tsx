import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Calendar } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { leaveRequestsApi, LeaveRequest, CreateLeaveRequestPayload, LeaveBalance } from '../services/leaveRequestsService';
import { leaveTypesApi, LeaveType } from '../services/leaveTypesService';
import { apiContext } from '../services/apiClient';
import { peopleApi } from '../services/peopleService';

const LeaveRequestsPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = usePeopleFormatters();
    const canCreate = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:leave_requests:create') ?? true);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<LeaveRequest | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadRequests = useCallback(async () => {
        try {
            setLoading(true);
            const params: { status?: string } = {};
            if (statusFilter) params.status = statusFilter;

            const result = await leaveRequestsApi.getAll(params);
            setRequests(result.data);
        } catch (error) {
            console.error('Failed to load leave requests:', error);
            setToast({ message: 'Failed to load leave requests', type: 'error' });
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
            setToast({ message: 'Leave request submitted successfully', type: 'success' });
            recordActivity({ eventType: 'people.leave.requested', eventCategory: 'data', description: `Leave request submitted from ${data.start_date} to ${data.end_date}`, resourceType: 'leave_request', resourceId: created.id }).catch(() => {});
            loadRequests();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to create leave request';
            setToast({ message: msg, type: 'error' });
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

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('my')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'my'
                            ? 'text-teal-400 border-b-2 border-teal-400'
                            : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    My Requests
                </button>
                <button
                    onClick={() => setActiveTab('team')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'team'
                            ? 'text-teal-400 border-b-2 border-teal-400'
                            : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    Team Requests
                </button>
            </div>

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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
    const [formData, setFormData] = useState<CreateLeaveRequestPayload>({
        person_id: '',
        leave_type_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        is_half_day_start: false,
        is_half_day_end: false,
        reason: '',
    });

    useEffect(() => {
        if (isOpen) {
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

    const calculateTotalDays = () => {
        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        let total = diffDays;
        if (formData.is_half_day_start) total -= 0.5;
        if (formData.is_half_day_end) total -= 0.5;

        return total;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.leave_type_id || !formData.reason || !formData.person_id) return;

        onCreate(formData);
    };

    const updateField = (field: keyof CreateLeaveRequestPayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const selectedBalance = balances.find(b => b.leave_type_id === formData.leave_type_id);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Request Leave">
            <form onSubmit={handleSubmit} className="space-y-5">
                {personError && (
                    <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-sm text-red-300">
                        {personError}
                    </div>
                )}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Leave Type *</label>
                    <select
                        required
                        value={formData.leave_type_id}
                        onChange={(e) => updateField('leave_type_id', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    >
                        <option value="">Select leave type</option>
                        {leaveTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </select>
                    {selectedBalance && (
                        <p className="mt-1 text-xs text-slate-400">
                            Available: <span className="text-teal-400 font-medium">{selectedBalance.available} days</span>
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Start Date *</label>
                        <input
                            type="date"
                            required
                            value={formData.start_date}
                            onChange={(e) => updateField('start_date', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                        <label className="flex items-center gap-2 mt-2">
                            <input
                                type="checkbox"
                                checked={formData.is_half_day_start}
                                onChange={(e) => updateField('is_half_day_start', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-xs text-slate-400">Half Day</span>
                        </label>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">End Date *</label>
                        <input
                            type="date"
                            required
                            value={formData.end_date}
                            onChange={(e) => updateField('end_date', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                        <label className="flex items-center gap-2 mt-2">
                            <input
                                type="checkbox"
                                checked={formData.is_half_day_end}
                                onChange={(e) => updateField('is_half_day_end', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-xs text-slate-400">Half Day</span>
                        </label>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <p className="text-sm text-slate-300">
                        Total Days: <span className="text-teal-400 font-medium">{calculateTotalDays()}</span>
                    </p>
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Reason *</label>
                    <textarea
                        required
                        value={formData.reason || ''}
                        onChange={(e) => updateField('reason', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        rows={3}
                        placeholder="Reason for leave..."
                    />
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
                        disabled={!!personError || !formData.person_id}
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
