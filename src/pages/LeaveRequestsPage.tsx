import React, { useEffect, useState, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { toast, Button, Avatar, ListPageTemplate, DataTable, Modal, DescriptionList, Stack, Cluster } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { leaveRequestsApi, LeaveRequest, CreateLeaveRequestPayload } from '../services/leaveRequestsService';
import { apiContext } from '../services/apiClient';
import LeaveRequestFormModal from '../components/leave/LeaveRequestFormModal';
import ApprovalProgress from '../components/leave/ApprovalProgress';

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
        { key: 'status', header: 'Status', align: 'center', render: (r) => <StatusBadge status={r.status} /> },
    ];

    return (
        <>
            <ListPageTemplate trail={[]}
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

            <LeaveRequestFormModal
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
                        { label: 'Status', value: <StatusBadge status={request.status} /> },
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

                <ApprovalProgress
                    approvals={shown.approvals ?? []}
                    submittedAt={shown.submitted_at}
                    submittedByName={shown.person?.full_name}
                    formatDateTime={formatters.formatDateTime}
                    fallbackRejectionReason={shown.status === 'rejected' ? shown.rejection_reason : undefined}
                />
            </Stack>
        </Modal>
    );
};

export default LeaveRequestsPage;
