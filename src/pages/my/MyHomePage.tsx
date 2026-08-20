import React, { useEffect, useState, useCallback } from 'react';
import { CalendarDays, Target, Users, Inbox } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { meService } from '../../services/meService';
import type { MyLeaveBalance, MyGoal, WhosOutEntry } from '../../services/meService';
import type { LeaveRequest } from '../../services/leaveRequestsService';
import { MyCard, StatusPill, ProgressBar, Avatar, Skeleton } from './myUi';

/**
 * The employee's landing page.
 *
 * People Connect had no employee surface at all — an employee was dropped into
 * the administrator's application with some menu items hidden, so the answer to
 * "what's happening with me?" lived nowhere. This page is that answer: my
 * balance, my open requests, my goals, and who is away.
 *
 * Every read goes through /me/*, so nothing here can show another person's row
 * regardless of what permissions the viewer's role happens to carry.
 */

const todayIso = () => new Date().toISOString().slice(0, 10);

const inDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

const MyHomePage: React.FC = () => {
    const [balances, setBalances] = useState<MyLeaveBalance[]>([]);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [goals, setGoals] = useState<MyGoal[]>([]);
    const [whosOut, setWhosOut] = useState<WhosOutEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        // Each panel is independent: one failing source should degrade that
        // card, not blank the whole page.
        const [b, r, g, w] = await Promise.allSettled([
            meService.myLeaveBalances(new Date().getFullYear()),
            meService.myLeaveRequests({ limit: 5 }),
            meService.myGoals({ status: 'active' }),
            meService.whosOut(todayIso(), inDays(7)),
        ]);

        if (b.status === 'fulfilled') setBalances(b.value.data);
        if (r.status === 'fulfilled') setRequests(r.value.data);
        if (g.status === 'fulfilled') setGoals(g.value.data);
        if (w.status === 'fulfilled') setWhosOut(w.value.data);
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const pending = requests.filter(r => r.status === 'pending');

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="My Work" subtitle="Your leave, goals and team at a glance" />

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton rows={2} />
                    <Skeleton rows={2} />
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    <MyCard
                        title="My leave balance"
                        icon={<CalendarDays size={14} />}
                        to="/people/my/leave"
                    >
                        {balances.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                No leave balances have been set up for you yet.
                            </p>
                        ) : (
                            <ul className="space-y-2.5">
                                {balances.map(b => (
                                    <li key={b.id} className="flex items-center justify-between">
                                        <span className="text-sm text-slate-300">
                                            {b.leave_type?.name ?? 'Leave'}
                                        </span>
                                        <span className="text-sm font-semibold text-slate-50">
                                            {b.available} days
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </MyCard>

                    <MyCard
                        title="My requests"
                        icon={<Inbox size={14} />}
                        to="/people/my/leave"
                    >
                        {requests.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                You haven&apos;t requested any leave yet.
                            </p>
                        ) : (
                            <>
                                {pending.length > 0 && (
                                    <p className="mb-2.5 text-xs text-amber-400">
                                        {pending.length} awaiting approval
                                    </p>
                                )}
                                <ul className="space-y-2.5">
                                    {requests.slice(0, 4).map(r => (
                                        <li key={r.id} className="flex items-center justify-between gap-3">
                                            <span className="text-sm text-slate-300">
                                                {r.start_date} → {r.end_date}
                                            </span>
                                            <StatusPill status={r.status} />
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </MyCard>

                    <MyCard title="My goals" icon={<Target size={14} />} to="/people/my/goals">
                        {goals.length === 0 ? (
                            <p className="text-sm text-slate-500">No active goals.</p>
                        ) : (
                            <ul className="space-y-3">
                                {goals.slice(0, 4).map(g => (
                                    <li key={g.id}>
                                        <div className="mb-1 flex items-center justify-between gap-3">
                                            <span className="truncate text-sm text-slate-300">{g.title}</span>
                                            <span className="text-xs text-slate-500">
                                                {g.progress_percentage ?? 0}%
                                            </span>
                                        </div>
                                        <ProgressBar percent={g.progress_percentage ?? 0} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </MyCard>

                    <MyCard title="Who's out this week" icon={<Users size={14} />}>
                        {whosOut.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                Nobody is scheduled to be away.
                            </p>
                        ) : (
                            <ul className="space-y-2.5">
                                {whosOut.slice(0, 6).map(w => (
                                    <li
                                        key={`${w.person_id}-${w.start_date}`}
                                        className="flex items-center justify-between gap-3"
                                    >
                                        <span className="flex min-w-0 items-center gap-2.5">
                                            <Avatar name={w.full_name} />
                                            <span className="truncate text-sm text-slate-300">
                                                {w.full_name ?? 'A colleague'}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs text-slate-500">
                                            {w.start_date === w.end_date
                                                ? w.start_date
                                                : `${w.start_date} → ${w.end_date}`}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </MyCard>
                </div>
            )}
        </div>
    );
};

export default MyHomePage;
