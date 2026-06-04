import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { leaveRequestsApi, LeaveRequest } from '../services/leaveRequestsService';

const LeaveApprovalsPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = usePeopleFormatters();
    const canApproveLeave = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:leaves:approve') ?? true);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadPendingApprovals = useCallback(async () => {
        try {
            setLoading(true);
            const result = await leaveRequestsApi.getPendingApprovals();
            setRequests(result.data);
        } catch (error) {
            console.error('Failed to load pending approvals:', error);
            setToast({ message: 'Failed to load pending approvals', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPendingApprovals();
    }, [loadPendingApprovals]);

    const handleApprove = async (request: LeaveRequest) => {
        if (!confirm(`Approve leave request for ${request.person?.full_name}?`)) return;

        try {
            await leaveRequestsApi.approve(request.id);
            setToast({ message: 'Leave request approved', type: 'success' });
            recordActivity({ eventType: 'people.leave.approved', eventCategory: 'data', description: `Leave request for ${request.person?.full_name || 'person'} was approved`, resourceType: 'leave_request', resourceId: request.id }).catch(() => {});
            loadPendingApprovals();
        } catch (error) {
            setToast({ message: 'Failed to approve request', type: 'error' });
        }
    };

    const handleReject = async () => {
        if (!rejectingRequest || !rejectionReason.trim()) return;

        try {
            await leaveRequestsApi.reject(rejectingRequest.id, rejectionReason);
            setToast({ message: 'Leave request rejected', type: 'success' });
            recordActivity({ eventType: 'people.leave.rejected', eventCategory: 'data', description: `Leave request for ${rejectingRequest.person?.full_name || 'person'} was rejected`, resourceType: 'leave_request', resourceId: rejectingRequest.id }).catch(() => {});
            setRejectingRequest(null);
            setRejectionReason('');
            loadPendingApprovals();
        } catch (error) {
            setToast({ message: 'Failed to reject request', type: 'error' });
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Pending Approvals"
                subtitle="Review and approve leave requests"
            />

            {/* Approvals Table */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <EmptyState
                    icon={Clock}
                    title="No pending approvals"
                    description="All leave requests have been processed."
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Requestor</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Leave Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Dates</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Total Days</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Submitted</th>
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
                                            <div>
                                                <div className="text-sm font-medium text-slate-50">{request.person?.full_name}</div>
                                                <div className="text-xs text-slate-500">{request.person?.email}</div>
                                            </div>
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
                                        {formatters.formatDate(request.start_date)} - {formatters.formatDate(request.end_date)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm font-medium text-slate-50">
                                        {request.total_days}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {request.submitted_at
                                            ? formatters.formatDate(request.submitted_at)
                                            : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {canApproveLeave && (
                                            <button
                                                onClick={() => handleApprove(request)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
                                            >
                                                <CheckCircle size={14} />
                                                Approve
                                            </button>
                                            )}
                                            <button
                                                onClick={() => setRejectingRequest(request)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors"
                                            >
                                                <XCircle size={14} />
                                                Reject
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Reject Modal */}
            <Modal
                isOpen={!!rejectingRequest}
                onClose={() => {
                    setRejectingRequest(null);
                    setRejectionReason('');
                }}
                title="Reject Leave Request"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-300">
                        Rejecting leave request for <span className="font-medium text-slate-50">{rejectingRequest?.person?.full_name}</span>
                    </p>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Rejection Reason *</label>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            rows={4}
                            placeholder="Please provide a reason for rejection..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                        <button
                            onClick={() => {
                                setRejectingRequest(null);
                                setRejectionReason('');
                            }}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={!rejectionReason.trim()}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Reject Request
                        </button>
                    </div>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default LeaveApprovalsPage;
