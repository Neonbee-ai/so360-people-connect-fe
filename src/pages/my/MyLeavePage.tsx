import React, { useEffect, useState, useCallback } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { Button, Cluster, DashboardPageTemplate, Grid, Stack, toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { MyLeaveBalance } from '../../services/meService';
import { leaveRequestsApi } from '../../services/leaveRequestsService';
import type { CreateLeaveRequestPayload, LeaveRequest } from '../../services/leaveRequestsService';
import LeaveRequestFormModal from '../../components/leave/LeaveRequestFormModal';
import { MyCard, StatTile, StatusPill, Skeleton } from './myUi';

/**
 * My Leave — the employee's own balances, history and request form.
 *
 * Replaces the admin Leave Requests queue as an employee's route to time off.
 * The old flow failed in two ways at once: the queue listed the whole
 * organisation's requests, and "Request Leave" made the browser supply a
 * person_id it did not reliably know, producing "No employee profile found for
 * your account". Here the person is never named by the client at all — the
 * backend takes it from the session.
 *
 * The request form is the same LeaveRequestFormModal the admin page uses
 * (Pulse 78626df8), so labels, half-day options, totals and validation match.
 * Only the save goes through /me, and balances come from /me/leave/balances.
 */

const MyLeavePage: React.FC = () => {
    const [balances, setBalances] = useState<MyLeaveBalance[]>([]);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [b, r] = await Promise.allSettled([
            meService.myLeaveBalances(new Date().getFullYear()),
            meService.myLeaveRequests({ limit: 100 }),
        ]);
        if (b.status === 'fulfilled') setBalances(b.value.data);
        if (r.status === 'fulfilled') setRequests(r.value.data);
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    // The employee's own balances, read through /me: the admin balances
    // endpoint needs a leave-read grant employees do not have.
    const loadMyBalances = useCallback(
        async () => (await meService.myLeaveBalances(new Date().getFullYear())).data || [],
        [],
    );

    const handleCreate = async (data: CreateLeaveRequestPayload, approverIds: string[]) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            // person_id is dropped: the backend resolves it from the session.
            // Created as a draft, then submitted to the selected approver(s) —
            // or the department-head chain when none are chosen.
            const { person_id: _ignored, ...payload } = data;
            void _ignored;
            const created = await meService.requestLeave(payload);
            await leaveRequestsApi.submit(created.id, approverIds);
            toast.success('Leave requested');
            setFormOpen(false);
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not submit your request');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <DashboardPageTemplate trail={[]}
                title="My Leave"
                description="Your balances and requests"
                primaryAction={
                    <Button onClick={() => setFormOpen(true)}>
                        <Plus size={16} /> Request Leave
                    </Button>
                }
                kpis={
                    balances.length > 0 ? (
                        <Grid columns="auto" gap="md">
                            {balances.map(b => (
                                <Grid.Item key={b.id} span={3}>
                                    <StatTile
                                        label={b.leave_type?.name ?? 'Leave'}
                                        value={b.available}
                                        hint={`days available · ${b.used} used`}
                                    />
                                </Grid.Item>
                            ))}
                        </Grid>
                    ) : undefined
                }
                primary={
                    <MyCard title="My requests" icon={<CalendarDays size={14} />}>
                        {loading ? (
                            <Skeleton rows={3} />
                        ) : requests.length === 0 ? (
                            <EmptyState
                                icon={CalendarDays}
                                title="No leave requests yet"
                                description="When you request time off it will appear here."
                            />
                        ) : (
                            <Stack gap="default">
                                {requests.map(r => (
                                    <Cluster key={r.id} justify="between">
                                        <Stack gap="tight">
                                            <p className="text-nb-sm text-fg">{r.leave_type?.name ?? 'Leave'}</p>
                                            <p className="text-nb-sm text-fg-subtle">
                                                {r.start_date} → {r.end_date}
                                                {r.total_days ? ` · ${r.total_days} day(s)` : ''}
                                            </p>
                                        </Stack>
                                        <StatusPill status={r.status} />
                                    </Cluster>
                                ))}
                            </Stack>
                        )}
                    </MyCard>
                }
            />

            <LeaveRequestFormModal
                isOpen={formOpen}
                submitting={submitting}
                onClose={() => setFormOpen(false)}
                onCreate={handleCreate}
                loadBalances={loadMyBalances}
            />
        </>
    );
};

export default MyLeavePage;
