import React, { useEffect, useState, useCallback } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import { toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { MyLeaveBalance } from '../../services/meService';
import type { LeaveRequest } from '../../services/leaveRequestsService';
import { leaveTypesApi, LeaveType } from '../../services/leaveTypesService';

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

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

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
        <div className="space-y-4">
            <PageHeader
                title="My Leave"
                subtitle="Your balances and requests"
                actions={
                    <button
                        onClick={() => setFormOpen(true)}
                        className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        <Plus size={16} /> Request leave
                    </button>
                }
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {balances.map(b => (
                    <div
                        key={b.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
                    >
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {b.leave_type?.name ?? 'Leave'}
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                            {b.available}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            days available · {b.used} used
                        </p>
                    </div>
                ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        My requests
                    </h2>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-sm text-slate-500">Loading…</div>
                ) : requests.length === 0 ? (
                    <EmptyState
                        icon={CalendarDays}
                        title="No leave requests yet"
                        description="When you request time off it will appear here."
                    />
                ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                        {requests.map(r => (
                            <li key={r.id} className="flex items-center justify-between px-4 py-3">
                                <div>
                                    <p className="text-sm text-slate-800 dark:text-slate-100">
                                        {r.leave_type?.name ?? 'Leave'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {r.start_date} → {r.end_date}
                                        {r.total_days ? ` · ${r.total_days} day(s)` : ''}
                                    </p>
                                </div>
                                <span
                                    className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                                        STATUS_STYLES[r.status] ?? STATUS_STYLES.draft
                                    }`}
                                >
                                    {r.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Modal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                title="Request leave"
            >
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                            Leave type
                        </label>
                        <select
                            value={form.leave_type_id}
                            onChange={e => setForm({ ...form, leave_type_id: e.target.value })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        >
                            <option value="">Select…</option>
                            {leaveTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                From
                            </label>
                            <input
                                type="date"
                                value={form.start_date}
                                onChange={e => setForm({ ...form, start_date: e.target.value })}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                To
                            </label>
                            <input
                                type="date"
                                value={form.end_date}
                                onChange={e => setForm({ ...form, end_date: e.target.value })}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                            Reason (optional)
                        </label>
                        <textarea
                            value={form.reason}
                            onChange={e => setForm({ ...form, reason: e.target.value })}
                            rows={3}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={() => setFormOpen(false)}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submit}
                            disabled={submitting}
                            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {submitting ? 'Submitting…' : 'Submit request'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default MyLeavePage;
