import React, { useEffect, useState, useCallback } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { Button, Cluster, DashboardPageTemplate, DateInput, Drawer, Grid, Select, Stack, Textarea, toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { MyLeaveBalance } from '../../services/meService';
import { leaveRequestsApi } from '../../services/leaveRequestsService';
import type { LeaveRequest } from '../../services/leaveRequestsService';
import { leaveTypesApi, LeaveType } from '../../services/leaveTypesService';
import { peopleApi } from '../../services/peopleService';
import ApproverSelector from '../../components/leave/ApproverSelector';
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
 */

const todayIso = () => new Date().toISOString().slice(0, 10);

const MyLeavePage: React.FC = () => {
    const [balances, setBalances] = useState<MyLeaveBalance[]>([]);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    // Needed only to scope the approver picker to this employee's eligible
    // population; every other call on this page resolves the person server-side.
    const [myPersonId, setMyPersonId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        leave_type_id: '',
        start_date: todayIso(),
        end_date: todayIso(),
        reason: '',
        approver_ids: [] as string[],
    });

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

    useEffect(() => {
        leaveTypesApi
            .getAll({ is_active: true })
            .then(res => setLeaveTypes(res.data))
            .catch(() => undefined);
    }, []);

    // Replaces a client-side fetch of up to 200 people that was then filtered in
    // the browser: the picker now asks the server, which ranks the reporting
    // manager first and caps the window.
    useEffect(() => {
        peopleApi
            .getMe()
            .then(person => setMyPersonId(person?.id ?? ''))
            .catch(() => undefined);
    }, []);

    const setApproverIds = (ids: string[]) =>
        setForm(f => ({ ...f, approver_ids: ids }));

    const submit = async () => {
        if (!form.leave_type_id) {
            toast.error('Choose a leave type');
            return;
        }
        if (form.end_date < form.start_date) {
            toast.error('The end date cannot be before the start date');
            return;
        }

        setSubmitting(true);
        try {
            // No person_id: the backend resolves it from the session. Created as
            // a draft, then submitted for approval routed to the selected
            // manager(s) — or the org's department-head chain when none chosen.
            const created = await meService.requestLeave({
                leave_type_id: form.leave_type_id,
                start_date: form.start_date,
                end_date: form.end_date,
                reason: form.reason || undefined,
            });
            await leaveRequestsApi.submit(created.id, form.approver_ids);
            toast.success('Leave requested');
            setFormOpen(false);
            setForm({
                leave_type_id: '',
                start_date: todayIso(),
                end_date: todayIso(),
                reason: '',
                approver_ids: [],
            });
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
                        <Plus size={16} /> Request leave
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

            <Drawer
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                title="Request leave"
                size="sm"
                footer={
                    <Cluster justify="end">
                        <Button variant="secondary" onClick={() => setFormOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={submit} disabled={submitting}>
                            {submitting ? 'Submitting…' : 'Submit request'}
                        </Button>
                    </Cluster>
                }
            >
                <Stack gap="default">
                    <Select
                        name="leave_type_id"
                        label="Leave type"
                        value={form.leave_type_id}
                        onChange={e => setForm({ ...form, leave_type_id: e.target.value })}
                        options={[{ value: '', label: 'Select…' }, ...leaveTypes.map(t => ({ value: t.id, label: t.name }))]}
                    />

                    <Grid columns={2}>
                        <DateInput
                            name="start_date"
                            label="From"
                            value={form.start_date}
                            onChange={iso => setForm({ ...form, start_date: iso })}
                        />
                        <DateInput
                            name="end_date"
                            label="To"
                            value={form.end_date}
                            onChange={iso => setForm({ ...form, end_date: iso })}
                        />
                    </Grid>

                    <Textarea
                        name="reason"
                        label="Reason (optional)"
                        value={form.reason}
                        onChange={e => setForm({ ...form, reason: e.target.value })}
                        rows={3}
                    />

                    {myPersonId && (
                        <ApproverSelector
                            personId={myPersonId}
                            value={form.approver_ids}
                            onChange={setApproverIds}
                            disabled={submitting}
                            helpText="Leave blank to route to your department's configured head."
                        />
                    )}
                </Stack>
            </Drawer>
        </>
    );
};

export default MyLeavePage;
