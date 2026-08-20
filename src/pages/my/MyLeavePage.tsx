import React, { useEffect, useState, useCallback } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { toast, Drawer } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { MyLeaveBalance } from '../../services/meService';
import type { LeaveRequest } from '../../services/leaveRequestsService';
import { leaveTypesApi, LeaveType } from '../../services/leaveTypesService';
import { MyCard, StatTile, StatusPill, Skeleton, primaryBtn, secondaryBtn, inputCls, labelCls } from './myUi';

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
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        leave_type_id: '',
        start_date: todayIso(),
        end_date: todayIso(),
        reason: '',
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
            // No person_id: the backend resolves it from the session.
            await meService.requestLeave({
                leave_type_id: form.leave_type_id,
                start_date: form.start_date,
                end_date: form.end_date,
                reason: form.reason || undefined,
            });
            toast.success('Leave requested');
            setFormOpen(false);
            setForm({
                leave_type_id: '',
                start_date: todayIso(),
                end_date: todayIso(),
                reason: '',
            });
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not submit your request');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="My Leave"
                subtitle="Your balances and requests"
                actions={
                    <button onClick={() => setFormOpen(true)} className={primaryBtn}>
                        <Plus size={16} /> Request leave
                    </button>
                }
            />

            {balances.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {balances.map(b => (
                        <StatTile
                            key={b.id}
                            label={b.leave_type?.name ?? 'Leave'}
                            value={b.available}
                            hint={`days available · ${b.used} used`}
                        />
                    ))}
                </div>
            )}

            <MyCard title="My requests" icon={<CalendarDays size={14} />} flush>
                {loading ? (
                    <Skeleton rows={3} className="p-4" />
                ) : requests.length === 0 ? (
                    <EmptyState
                        icon={CalendarDays}
                        title="No leave requests yet"
                        description="When you request time off it will appear here."
                    />
                ) : (
                    <ul className="divide-y divide-slate-800">
                        {requests.map(r => (
                            <li key={r.id} className="flex items-center justify-between px-4 py-3">
                                <div>
                                    <p className="text-sm text-slate-50">
                                        {r.leave_type?.name ?? 'Leave'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {r.start_date} → {r.end_date}
                                        {r.total_days ? ` · ${r.total_days} day(s)` : ''}
                                    </p>
                                </div>
                                <StatusPill status={r.status} />
                            </li>
                        ))}
                    </ul>
                )}
            </MyCard>

            <Drawer
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                title="Request leave"
                size="sm"
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setFormOpen(false)} className={secondaryBtn}>
                            Cancel
                        </button>
                        <button onClick={submit} disabled={submitting} className={primaryBtn}>
                            {submitting ? 'Submitting…' : 'Submit request'}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Leave type</label>
                        <select
                            value={form.leave_type_id}
                            onChange={e => setForm({ ...form, leave_type_id: e.target.value })}
                            className={inputCls}
                        >
                            <option value="">Select…</option>
                            {leaveTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>From</label>
                            <input
                                type="date"
                                value={form.start_date}
                                onChange={e => setForm({ ...form, start_date: e.target.value })}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>To</label>
                            <input
                                type="date"
                                value={form.end_date}
                                onChange={e => setForm({ ...form, end_date: e.target.value })}
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Reason (optional)</label>
                        <textarea
                            value={form.reason}
                            onChange={e => setForm({ ...form, reason: e.target.value })}
                            rows={3}
                            className={inputCls}
                        />
                    </div>
                </div>
            </Drawer>
        </div>
    );
};

export default MyLeavePage;
