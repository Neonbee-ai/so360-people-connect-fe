import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, XCircle, CalendarDays } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { toast, getErrorMessage, Button, Badge, Card, Textarea, Skeleton, DescriptionList, DetailPageTemplate, Stack, Cluster } from '@so360/design-system';
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
        return (
            <DetailPageTemplate trail={[{ label: 'Leave Requests', to: '/people/leaves/requests' }]} title="Leave Request">
                <div data-testid="leave-detail-loading"><Skeleton /></div>
            </DetailPageTemplate>
        );
    }

    if (notFound || !request) {
        return (
            <DetailPageTemplate trail={[{ label: 'Leave Requests', to: '/people/leaves/requests' }]} title="Leave Request">
                <Stack gap="default">
                    <EmptyState icon={CalendarDays} title="Leave request not found" description="It may have been deleted, or you may not have access to it." />
                    <Link to="/people/leaves/requests" className="text-nb-body text-primary hover:underline">Back to leave requests</Link>
                </Stack>
            </DetailPageTemplate>
        );
    }

    const isPending = request.status === 'pending';
    const showActions = canDecide && isPending;
    const statusTone = request.status === 'approved' ? 'success' : request.status === 'pending' ? 'warning' : request.status === 'rejected' ? 'danger' : 'neutral';

    return (
        <DetailPageTemplate trail={[{ label: 'Leave Requests', to: '/people/leaves/requests' }]}
            title="Leave Request"
            meta={<span>{request.person?.full_name ?? ''}</span>}
            status={<span data-testid="leave-status"><Badge tone={statusTone}>{request.status}</Badge></span>}
            primaryAction={showActions && !rejecting ? (
                <Button variant="primary" onClick={approve} disabled={acting}>
                    <CheckCircle size={16} /> Approve
                </Button>
            ) : undefined}
            secondaryActions={showActions && !rejecting ? [
                <Button key="reject" variant="danger" onClick={() => setRejecting(true)} disabled={acting}>
                    <XCircle size={16} /> Reject
                </Button>,
            ] : undefined}
        >
            <Stack gap="default">
                <Card title={request.leave_type?.name ?? 'Leave'}>
                    <Stack gap="default">
                        <DescriptionList
                            columns={2}
                            items={[
                                { label: 'From', value: formatters.formatDate(request.start_date) },
                                { label: 'To', value: formatters.formatDate(request.end_date) },
                                { label: 'Days', value: request.total_days },
                                { label: 'Balance available', value: balance ? <span data-testid="leave-balance">{balance.available}</span> : null, hidden: !balance },
                            ]}
                        />
                        {request.reason && <p className="text-nb-body text-fg">{request.reason}</p>}
                    </Stack>
                </Card>

                {/* Per-approver reasons live in the approval progress (Pulse 85d80186);
                    the request-level reason is only a fallback for old rejections. */}
                <ApprovalProgress
                    approvals={request.approvals ?? []}
                    submittedAt={request.submitted_at}
                    submittedByName={request.person?.full_name}
                    formatDateTime={formatters.formatDateTime}
                    fallbackRejectionReason={request.status === 'rejected' ? request.rejection_reason : undefined}
                />

                {showActions && rejecting && (
                    <Stack gap="default">
                        <Textarea
                            name="leave-reject-reason"
                            label="Rejection Reason *"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                        />
                        <Cluster gap="default">
                            <Button variant="secondary" onClick={() => { setRejecting(false); setReason(''); }}>Cancel</Button>
                            <Button variant="danger" onClick={reject} disabled={!reason.trim() || acting}>Confirm Reject</Button>
                        </Cluster>
                    </Stack>
                )}
            </Stack>
        </DetailPageTemplate>
    );
};

export default LeaveRequestDetailPage;
