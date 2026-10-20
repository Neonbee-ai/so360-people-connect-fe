import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { toast, getErrorMessage, useConfirm, Button, ListPageTemplate, DataTable, Modal, Textarea, Avatar, DescriptionList, Stack, Cluster } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
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

    const columns: DataTableColumn<LeaveRequest>[] = [
        {
            key: 'requestor',
            header: 'Requestor',
            render: (r) => (
                <Cluster gap="tight" align="center">
                    <Avatar name={r.person?.full_name} src={r.person?.avatar_url || undefined} size="sm" />
                    <Stack gap="none">
                        <span className="text-nb-body font-medium text-fg">{r.person?.full_name}</span>
                        <span className="text-nb-caption text-fg-subtle">{r.person?.email}</span>
                    </Stack>
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
            key: 'dates',
            header: 'Dates',
            render: (r) => <span className="text-fg-muted">{formatters.formatDate(r.start_date)} - {formatters.formatDate(r.end_date)}</span>,
        },
        {
            key: 'total_days',
            header: 'Total Days',
            align: 'center',
            render: (r) => (
                <span className="font-medium text-fg">
                    {r.total_days}
                    {(r.is_half_day_start || r.is_half_day_end) && <span className="ml-nb-1 text-nb-caption text-fg-subtle">½</span>}
                </span>
            ),
        },
        {
            // Tells the approver they are one of several BEFORE they decide.
            key: 'approvals',
            header: 'Approvals',
            render: (r) => (r.approvals_required ?? 0) > 1
                ? <span className="text-nb-caption text-warning">{r.approvals_completed ?? 0} of {r.approvals_required} approved</span>
                : <span className="text-nb-caption text-fg-subtle">—</span>,
        },
        {
            key: 'submitted',
            header: 'Submitted',
            hideBelow: 'medium',
            render: (r) => <span className="text-fg-muted">{r.submitted_at ? formatters.formatDate(r.submitted_at) : '-'}</span>,
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (r) => (
                <Cluster gap="tight" justify="end" align="center">
                    {/* Opening a request must never change its state: Review is read-only. */}
                    <Button size="sm" variant="secondary" onClick={() => setViewing(r)}>
                        <Eye size={14} />
                        Review
                    </Button>
                    {canApproveLeave && (
                        <Button size="sm" variant="primary" onClick={() => handleApprove(r)} disabled={actingId === r.id}>
                            <CheckCircle size={14} />
                            Approve
                        </Button>
                    )}
                    {/* Gated on the same flag as Approve: rejecting is a decision too. */}
                    {canApproveLeave && (
                        <Button size="sm" variant="danger" onClick={() => setRejectingRequest(r)} disabled={actingId === r.id}>
                            <XCircle size={14} />
                            Reject
                        </Button>
                    )}
                </Cluster>
            ),
        },
    ];

    const closeReject = () => {
        setRejectingRequest(null);
        setRejectionReason('');
    };

    return (
        <ListPageTemplate trail={[]}
            title="Pending Approvals"
            description="Review and approve leave requests"
            loading={loading}
            isEmpty={requests.length === 0}
            empty={
                <EmptyState
                    icon={Clock}
                    title="No pending approvals"
                    description="All leave requests have been processed."
                />
            }
        >
            {confirmDialog}
            <DataTable
                name="leave-approvals"
                columns={columns}
                rows={requests}
                rowKey={(r) => r.id}
            />

            {/* Review Modal — read-only. Opening a request never decides it. */}
            <ReviewRequestModal
                request={viewing}
                onClose={() => setViewing(null)}
                formatters={formatters}
            />

            {/* Reject Modal */}
            <Modal
                open={!!rejectingRequest}
                onClose={closeReject}
                title="Reject Leave Request"
                footer={
                    <Cluster gap="default" justify="end">
                        <Button variant="ghost" onClick={closeReject}>Cancel</Button>
                        <Button variant="danger" onClick={handleReject} disabled={!rejectionReason.trim()}>Reject Request</Button>
                    </Cluster>
                }
            >
                <Stack gap="default">
                    <p className="text-nb-body text-fg">
                        Rejecting leave request for <span className="font-medium text-fg">{rejectingRequest?.person?.full_name}</span>
                    </p>
                    <Textarea
                        name="rejection-reason"
                        label="Rejection Reason *"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={4}
                        placeholder="Please provide a reason for rejection..."
                    />
                </Stack>
            </Modal>
        </ListPageTemplate>
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
    <Modal
      open={!!request}
      onClose={onClose}
      title="Leave Request"
      footer={<Cluster gap="default" justify="end"><Button variant="ghost" onClick={onClose}>Close</Button></Cluster>}
    >
      <Stack gap="default">
        <DescriptionList
          columns={2}
          items={[
            {
              label: 'Employee',
              value: (
                <Stack gap="none">
                  <span className="font-medium">{shown.person?.full_name || '—'}</span>
                  {shown.person?.email && <span className="text-nb-caption text-fg-subtle">{shown.person.email}</span>}
                </Stack>
              ),
            },
            { label: 'Department', value: shown.person?.department || '—' },
            { label: 'Leave Type', value: shown.leave_type?.name || '—' },
            { label: 'Total Days', value: `${shown.total_days} day${shown.total_days !== 1 ? 's' : ''}` },
            { label: 'Start Date', value: formatters.formatDate(shown.start_date) },
            { label: 'End Date', value: formatters.formatDate(shown.end_date) },
            { label: 'Day Type', value: halfDayNote, span: 2 },
            { label: 'Submitted', value: shown.submitted_at ? formatters.formatDateTime(shown.submitted_at) : null, span: 2, hidden: !shown.submitted_at },
            { label: 'Reason', value: shown.reason, span: 2, hidden: !shown.reason },
          ]}
        />

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

export default LeaveApprovalsPage;
