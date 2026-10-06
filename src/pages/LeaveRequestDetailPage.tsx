import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, XCircle, CalendarDays } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { toast, getErrorMessage } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { leaveRequestsApi, LeaveRequest, LeaveBalance } from '../services/leaveRequestsService';
import ApprovalProgress from '../components/leave/ApprovalProgress';

/**
 * Deep-link target for a single leave request (`leaves/requests/:id`) — the
 * "View in People Connect" link Signal's leave item opens. Read-only for the
 * requester; approvers with `leave.approve` can decide it in place.
 */
const LeaveRequestDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const shell = useShellBridge();
    const formatters = usePeopleFormatters();
    const canDecide =
        (shell?.hasPermission?.('leave.approve') ?? false) &&
        (shell?.effectiveFlagsLoaded !== false) &&
        (shell?.isFeatureEnabled?.('action:people:leaves:approve') ?? true);

    const [request, setRequest] = useState<LeaveRequest | null>(null);
    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [acting, setActing] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');

    const load = useCallback(async () => {
        if (!id) { setNotFound(true); setLoading(false); return; }
        try {
            setLoading(true);
            const lr = await leaveRequestsApi.getById(id);
            if (!lr) { setNotFound(true); return; }
            setNotFound(false);
            setRequest(lr);
            // Balance impact is best-effort — never block the decision on it.
            leaveRequestsApi.getBalances(lr.person_id)
                .then((res) => {
                    const year = new Date(lr.start_date).getFullYear();
                    const rows = res?.data ?? [];
                    setBalance(rows.find((b) => b.leave_type_id === lr.leave_type_id && (!b.fiscal_year || b.fiscal_year === year)) ?? rows.find((b) => b.leave_type_id === lr.leave_type_id) ?? null);
                })
                .catch(() => setBalance(null));
        } catch (error) {
            console.error('Failed to load leave request:', error);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const approve = async () => {
        if (!request || acting) return;
        setActing(true);
        try {
            const result = await leaveRequestsApi.approve(request.id);
            const required = result?.approvals_required ?? 0;
            const completed = result?.approvals_completed ?? 0;
            toast.success(
                result?.fully_approved === false && required > 1
                    ? `Your approval is recorded — ${completed} of ${required} approvals complete.`
                    : 'Leave request approved',
            );
            await load();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to approve request'));
        } finally {
            setActing(false);
        }
    };

    const reject = async () => {
        if (!request || !reason.trim() || acting) return;
        setActing(true);
        try {
            await leaveRequestsApi.reject(request.id, reason.trim());
            toast.success('Leave request rejected');
            setRejecting(false);
            setReason('');
            await load();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to reject request'));
        } finally {
            setActing(false);
        }
    };

    if (loading) {
        return <div className="p-6"><div className="h-40 bg-slate-800/50 rounded-xl animate-pulse" data-testid="leave-detail-loading" /></div>;
    }

    if (notFound || !request) {
        return (
            <div className="p-6 space-y-4">
                <EmptyState icon={CalendarDays} title="Leave request not found" description="It may have been deleted, or you may not have access to it." />
                <Link to="/people/leaves/requests" className="text-sm text-teal-400 hover:underline">Back to leave requests</Link>
            </div>
        );
    }

    const isPending = request.status === 'pending';
    const showActions = canDecide && isPending;

    return (
        <div className="p-6 space-y-5 max-w-3xl">
            <PageHeader title="Leave Request" subtitle={request.person?.full_name ?? ''} />

            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-50 font-medium">{request.leave_type?.name ?? 'Leave'}</span>
                    <span data-testid="leave-status" className="text-xs uppercase tracking-wide text-slate-300">{request.status}</span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-slate-400">From</dt><dd className="text-slate-50">{formatters.formatDate(request.start_date)}</dd></div>
                    <div><dt className="text-xs text-slate-400">To</dt><dd className="text-slate-50">{formatters.formatDate(request.end_date)}</dd></div>
                    <div><dt className="text-xs text-slate-400">Days</dt><dd className="text-slate-50">{request.total_days}</dd></div>
                    {balance && (
                        <div>
                            <dt className="text-xs text-slate-400">Balance available</dt>
                            <dd className="text-slate-50" data-testid="leave-balance">{balance.available}</dd>
                        </div>
                    )}
                </dl>
                {request.reason && <p className="text-sm text-slate-300">{request.reason}</p>}
                {request.status === 'rejected' && request.rejection_reason && (
                    <p className="text-sm text-rose-400">Rejected: {request.rejection_reason}</p>
                )}
            </div>

            {request.approvals && request.approvals.length > 0 && (
                <ApprovalProgress
                    approvals={request.approvals}
                    submittedAt={request.submitted_at}
                    submittedByName={request.person?.full_name}
                    formatDateTime={formatters.formatDateTime}
                />
            )}

            {showActions && !rejecting && (
                <div className="flex gap-2">
                    <button onClick={approve} disabled={acting} className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                        <CheckCircle size={16} /> Approve
                    </button>
                    <button onClick={() => setRejecting(true)} disabled={acting} className="flex items-center gap-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                        <XCircle size={16} /> Reject
                    </button>
                </div>
            )}

            {showActions && rejecting && (
                <div className="space-y-3">
                    <label className="block text-xs text-slate-400" htmlFor="leave-reject-reason">Rejection Reason *</label>
                    <textarea
                        id="leave-reject-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    />
                    <div className="flex gap-2">
                        <button onClick={() => { setRejecting(false); setReason(''); }} className="px-4 py-2 text-sm text-slate-300 border border-slate-700 rounded-lg">Cancel</button>
                        <button onClick={reject} disabled={!reason.trim() || acting} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">Confirm Reject</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveRequestDetailPage;
