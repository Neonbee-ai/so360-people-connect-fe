import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast, getErrorMessage } from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { leaveRequestsApi, LeaveRequest } from '../services/leaveRequestsService';
import ApprovalProgress from '../components/leave/ApprovalProgress';

const LeaveApprovalsPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = usePeopleFormatters();
    const canApproveLeave = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:leaves:approve') ?? true);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [approvingRequest, setApprovingRequest] = useState<LeaveRequest | null>(null);
    const [approvalNotes, setApprovalNotes] = useState('');
    // Disables both actions on the row being decided, so a double-click can't
    // fire approve twice (the second now 400s, but the UI shouldn't invite it).
    const [actingId, setActingId] = useState<string | null>(null);
    const [viewing, setViewing] = useState<LeaveRequest | null>(null);

    const loadPendingApprovals = useCallback(async () => {
        try {
            setLoading(true);
            const result = await leaveRequestsApi.getPendingApprovals();
            setRequests(result.data);
        } catch (error) {
            console.error('Failed to load pending approvals:', error);
            toast.error('Failed to load pending approvals');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPendingApprovals();
    }, [loadPendingApprovals]);

    const openApprove = (request: LeaveRequest) => {
        setViewing(null);
        setApprovalNotes('');
        setApprovingRequest(request);
    };

    const handleApprove = async (request: LeaveRequest, notes: string) => {
        if (actingId) return;

        setActingId(request.id);
        try {
            const result = await leaveRequestsApi.approve(request.id, notes.trim() || undefined);
            // Multi-approver requests stay pending until everyone has approved.
            // Saying "approved" here when it isn't would be a lie the approver
            // has no way to check.
            const required = result?.approvals_required ?? 0;
            const completed = result?.approvals_completed ?? 0;
            toast.success(
                result?.fully_approved === false && required > 1
                    ? `Your approval is recorded — ${completed} of ${required} approvals complete. Awaiting the other approver(s).`
                    : 'Leave request approved',
            );
            recordActivity({ eventType: 'people.leave.approved', eventCategory: 'data', description: `Leave request for ${request.person?.full_name || 'person'} was approved`, resourceType: 'leave_request', resourceId: request.id }).catch(() => {});
            loadPendingApprovals();
        } catch (error) {
            // Surface the server's message — "not routed to you", "already
            // approved" and "no longer pending" are all actionable, and the old
            // blanket string hid every one of them.
            toast.error(getErrorMessage(error, 'Failed to approve request'));
        } finally {
            setActingId(null);
        }
    };

    const handleReject = async () => {
        if (!rejectingRequest || !rejectionReason.trim() || actingId) return;

        setActingId(rejectingRequest.id);
        try {
            await leaveRequestsApi.reject(rejectingRequest.id, rejectionReason.trim());
            toast.success('Leave request rejected');
            recordActivity({ eventType: 'people.leave.rejected', eventCategory: 'data', description: `Leave request for ${rejectingRequest.person?.full_name || 'person'} was rejected`, resourceType: 'leave_request', resourceId: rejectingRequest.id }).catch(() => {});
            setRejectingRequest(null);
            setRejectionReason('');
            loadPendingApprovals();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to reject request'));
        } finally {
            setActingId(null);
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
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Approvals</th>
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
                                        {(request.is_half_day_start || request.is_half_day_end) && (
                                            <span className="ml-1 text-xs text-slate-500">½</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {/* Tells the approver they are one of several
                                            BEFORE they decide — otherwise approving
                                            looks like it grants the leave outright. */}
                                        {(request.approvals_required ?? 0) > 1 ? (
                                            <span className="text-xs text-amber-400">
                                                {request.approvals_completed ?? 0} of {request.approvals_required} approved
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-500">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {request.submitted_at
                                            ? formatters.formatDate(request.submitted_at)
                                            : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {/* Opening a request must never change its state —
                                                Review is read-only, the decision is explicit. */}
                                            <button
                                                onClick={() => setViewing(request)}
                                                className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
                                            >
                                                <Eye size={14} />
                                                Review
                                            </button>
                                            {canApproveLeave && (
                                            <button
                                                onClick={() => openApprove(request)}
                                                disabled={actingId === request.id}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <CheckCircle size={14} />
                                                Approve
                                            </button>
                                            )}
                                            {/* Gated on the same flag as Approve: rejecting is
                                                a decision on the request too, and showing it to
                                                someone who can't approve offered half a power. */}
                                            {canApproveLeave && (
                                            <button
                                                onClick={() => setRejectingRequest(request)}
                                                disabled={actingId === request.id}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <XCircle size={14} />
                                                Reject
                                            </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Review Modal — read-only. Opening a request never decides it. */}
            <ReviewRequestModal
                request={viewing}
                onClose={() => setViewing(null)}
                formatters={formatters}
                onApprove={canApproveLeave ? openApprove : undefined}
            />

            {/* Approve Modal — replaces the browser confirm; notes are optional */}
            <Modal
                isOpen={!!approvingRequest}
                onClose={() => { setApprovingRequest(null); setApprovalNotes(''); }}
                title="Approve Leave Request"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-300">
                        Approving leave request for <span className="font-medium text-slate-50">{approvingRequest?.person?.full_name}</span>
                    </p>
                    <div>
                        <label htmlFor="approval-notes" className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                        <textarea
                            id="approval-notes"
                            value={approvalNotes}
                            onChange={(e) => setApprovalNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            rows={3}
                            placeholder="Add a comment or conditions for this approval..."
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                        <button
                            onClick={() => { setApprovingRequest(null); setApprovalNotes(''); }}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                const req = approvingRequest;
                                if (!req) return;
                                await handleApprove(req, approvalNotes);
                                setApprovingRequest(null);
                                setApprovalNotes('');
                            }}
                            disabled={!!actingId}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Approve Request
                        </button>
                    </div>
                </div>
            </Modal>

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

        </div>
    );
};

// =============================================================================
// Review Modal — everything the approver needs to decide, in one place
// =============================================================================

interface ReviewRequestModalProps {
  request: LeaveRequest | null;
  onClose: () => void;
  formatters: { formatDate: (d: string) => string; formatDateTime: (d: string) => string };
  /** When provided, the footer offers Approve and continues into the same approve flow. */
  onApprove?: (request: LeaveRequest) => void;
}

/**
 * Read-only. The approver reads here and decides from the row — opening a
 * request must not be mistakable for acting on it.
 *
 * The pending-approvals list doesn't join the approval chain, so the detail is
 * fetched on open to show who else is involved and what they have already said.
 */
const ReviewRequestModal: React.FC<ReviewRequestModalProps> = ({ request, onClose, formatters, onApprove }) => {
  const [detail, setDetail] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    if (!request) { setDetail(null); return; }
    let cancelled = false;
    leaveRequestsApi
      .getById(request.id)
      .then(full => { if (!cancelled) setDetail(full); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [request?.id]);

  if (!request) return null;
  const shown = detail ?? request;

  const halfDayNote = shown.is_half_day_start && shown.is_half_day_end
    ? 'Half day on both the first and last day'
    : shown.is_half_day_start
      ? 'Half day on the start date'
      : shown.is_half_day_end
        ? 'Half day on the end date'
        : 'Full days';

  return (
    <Modal isOpen={!!request} onClose={onClose} title="Leave Request">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs text-slate-400">Employee</p>
            <p className="text-sm font-medium text-slate-50">{shown.person?.full_name || '—'}</p>
            {shown.person?.email && (
              <p className="text-xs text-slate-500">{shown.person.email}</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">Department</p>
            <p className="text-sm text-slate-50">{shown.person?.department || '—'}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">Leave Type</p>
            <p className="text-sm text-slate-50">{shown.leave_type?.name || '—'}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">Total Days</p>
            <p className="text-sm font-medium text-slate-50">
              {shown.total_days} day{shown.total_days !== 1 ? 's' : ''}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">Start Date</p>
            <p className="text-sm text-slate-50">{formatters.formatDate(shown.start_date)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">End Date</p>
            <p className="text-sm text-slate-50">{formatters.formatDate(shown.end_date)}</p>
          </div>
          <div className="col-span-2">
            <p className="mb-1 text-xs text-slate-400">Day Type</p>
            <p className="text-sm text-slate-50">{halfDayNote}</p>
          </div>
          {shown.submitted_at && (
            <div className="col-span-2">
              <p className="mb-1 text-xs text-slate-400">Submitted</p>
              <p className="text-sm text-slate-50">{formatters.formatDateTime(shown.submitted_at)}</p>
            </div>
          )}
        </div>

        {shown.reason && (
          <div>
            <p className="mb-1 text-xs text-slate-400">Reason</p>
            <p className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm text-slate-300">
              {shown.reason}
            </p>
          </div>
        )}

        <ApprovalProgress
          fallbackRejectionReason={shown.status === 'rejected' ? shown.rejection_reason : undefined}
          approvals={shown.approvals ?? []}
          submittedAt={shown.submitted_at}
          submittedByName={shown.person?.full_name}
          formatDateTime={formatters.formatDateTime}
        />

        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 transition-colors hover:text-slate-50"
          >
            Close
          </button>
          {onApprove && (
            <button
              onClick={() => onApprove(request)}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Approve
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default LeaveApprovalsPage;
