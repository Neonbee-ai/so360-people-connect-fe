import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast, getErrorMessage, useConfirm } from '@so360/design-system';
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

    const [confirm, confirmDialog] = useConfirm();

    const handleApprove = async (request: LeaveRequest) => {
        if (!(await confirm({ title: 'Approve leave', message: `Approve leave request for ${request.person?.full_name}?`, confirmLabel: 'Approve' }))) return;
        if (actingId) return;

        setActingId(request.id);
        try {
            const result = await leaveRequestsApi.approve(request.id);
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
          {confirmDialog}
            <PageHeader
                title="Pending Approvals"
                subtitle="Review and approve leave requests"
            />

            {/* Approvals Table */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-surface-raised/50 rounded-nb animate-pulse" />
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <EmptyState
                    icon={Clock}
                    title="No pending approvals"
                    description="All leave requests have been processed."
                />
            ) : (
                <div className="bg-surface border border-line rounded-nb overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-surface-raised/50 border-b border-line">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Requestor</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Leave Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Dates</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Total Days</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Approvals</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Submitted</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {requests.map(request => (
                                <tr key={request.id} className="hover:bg-surface-raised/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/20 border border-line-strong flex items-center justify-center flex-shrink-0">
                                                {request.person?.avatar_url ? (
                                                    <img src={request.person.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                                ) : (
                                                    <span className="text-xs font-medium text-primary">
                                                        {request.person?.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-fg">{request.person?.full_name}</div>
                                                <div className="text-xs text-fg-subtle">{request.person?.email}</div>
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
                                            <span className="text-sm text-fg">{request.leave_type?.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">
                                        {formatters.formatDate(request.start_date)} - {formatters.formatDate(request.end_date)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm font-medium text-fg">
                                        {request.total_days}
                                        {(request.is_half_day_start || request.is_half_day_end) && (
                                            <span className="ml-1 text-xs text-fg-subtle">½</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {/* Tells the approver they are one of several
                                            BEFORE they decide — otherwise approving
                                            looks like it grants the leave outright. */}
                                        {(request.approvals_required ?? 0) > 1 ? (
                                            <span className="text-xs text-warning">
                                                {request.approvals_completed ?? 0} of {request.approvals_required} approved
                                            </span>
                                        ) : (
                                            <span className="text-xs text-fg-subtle">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">
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
                                                className="flex items-center gap-1 rounded-nb border border-line-strong px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-raised"
                                            >
                                                <Eye size={14} />
                                                Review
                                            </button>
                                            {canApproveLeave && (
                                            <button
                                                onClick={() => handleApprove(request)}
                                                disabled={actingId === request.id}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-success hover:bg-success text-success-fg text-xs font-medium rounded-nb transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                                className="flex items-center gap-1 px-3 py-1.5 bg-danger hover:bg-danger-hover text-danger-fg text-xs font-medium rounded-nb transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            />

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
                    <p className="text-sm text-fg">
                        Rejecting leave request for <span className="font-medium text-fg">{rejectingRequest?.person?.full_name}</span>
                    </p>

                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Rejection Reason *</label>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                            rows={4}
                            placeholder="Please provide a reason for rejection..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-line">
                        <button
                            onClick={() => {
                                setRejectingRequest(null);
                                setRejectionReason('');
                            }}
                            className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={!rejectionReason.trim()}
                            className="px-4 py-2 bg-danger hover:bg-danger-hover text-danger-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
}

/**
 * Read-only. The approver reads here and decides from the row — opening a
 * request must not be mistakable for acting on it.
 *
 * The pending-approvals list doesn't join the approval chain, so the detail is
 * fetched on open to show who else is involved and what they have already said.
 */
const ReviewRequestModal: React.FC<ReviewRequestModalProps> = ({ request, onClose, formatters }) => {
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
            <p className="mb-1 text-xs text-fg-muted">Employee</p>
            <p className="text-sm font-medium text-fg">{shown.person?.full_name || '—'}</p>
            {shown.person?.email && (
              <p className="text-xs text-fg-subtle">{shown.person.email}</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-fg-muted">Department</p>
            <p className="text-sm text-fg">{shown.person?.department || '—'}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-fg-muted">Leave Type</p>
            <p className="text-sm text-fg">{shown.leave_type?.name || '—'}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-fg-muted">Total Days</p>
            <p className="text-sm font-medium text-fg">
              {shown.total_days} day{shown.total_days !== 1 ? 's' : ''}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-fg-muted">Start Date</p>
            <p className="text-sm text-fg">{formatters.formatDate(shown.start_date)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-fg-muted">End Date</p>
            <p className="text-sm text-fg">{formatters.formatDate(shown.end_date)}</p>
          </div>
          <div className="col-span-2">
            <p className="mb-1 text-xs text-fg-muted">Day Type</p>
            <p className="text-sm text-fg">{halfDayNote}</p>
          </div>
          {shown.submitted_at && (
            <div className="col-span-2">
              <p className="mb-1 text-xs text-fg-muted">Submitted</p>
              <p className="text-sm text-fg">{formatters.formatDateTime(shown.submitted_at)}</p>
            </div>
          )}
        </div>

        {shown.reason && (
          <div>
            <p className="mb-1 text-xs text-fg-muted">Reason</p>
            <p className="rounded-nb border border-line-strong bg-surface-raised/50 p-3 text-sm text-fg">
              {shown.reason}
            </p>
          </div>
        )}

        <ApprovalProgress
          approvals={shown.approvals ?? []}
          submittedAt={shown.submitted_at}
          submittedByName={shown.person?.full_name}
          formatDateTime={formatters.formatDateTime}
        />

        <div className="flex justify-end border-t border-line pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-fg-muted transition-colors hover:text-fg"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LeaveApprovalsPage;
