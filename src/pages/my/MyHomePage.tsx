import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Target, Users, ArrowRight } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { meService } from '../../services/meService';
import type { MyLeaveBalance, MyGoal, WhosOutEntry } from '../../services/meService';
import type { LeaveRequest } from '../../services/leaveRequestsService';

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

const Card: React.FC<{
    title: string;
    icon: React.ReactNode;
    to?: string;
    children: React.ReactNode;
}> = ({ title, icon, to, children }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                {icon}
                <h2 className="text-sm font-semibold">{title}</h2>
            </div>
            {to && (
                <Link
                    to={to}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                    View all <ArrowRight size={12} />
                </Link>
            )}
        </div>
        {children}
    </div>
);

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
        <div className="space-y-4">
            <PageHeader title="My Work" subtitle="Your leave, goals and team at a glance" />

            {loading ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card
                        title="My leave balance"
                        icon={<CalendarDays size={16} />}
                        to="/people/my/leave"
                    >
                        {balances.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                No leave balances have been set up for you yet.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {balances.map(b => (
                                    <li key={b.id} className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-300">
                                            {b.leave_type?.name ?? 'Leave'}
                                        </span>
                                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                                            {b.available} days
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card
                        title="My requests"
                        icon={<CalendarDays size={16} />}
                        to="/people/my/leave"
                    >
                        {requests.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                You haven&apos;t requested any leave yet.
                            </p>
                        ) : (
                            <>
                                {pending.length > 0 && (
                                    <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                                        {pending.length} awaiting approval
                                    </p>
                                )}
                                <ul className="space-y-2">
                                    {requests.slice(0, 4).map(r => (
                                        <li key={r.id} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-300">
                                                {r.start_date} → {r.end_date}
                                            </span>
                                            <span className="text-xs capitalize text-slate-500 dark:text-slate-400">
                                                {r.status}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </Card>

                    <Card title="My goals" icon={<Target size={16} />} to="/people/my/goals">
                        {goals.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                No active goals.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {goals.slice(0, 4).map(g => (
                                    <li key={g.id} className="text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-300">{g.title}</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {g.progress_percentage ?? 0}%
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card title="Who's out this week" icon={<Users size={16} />}>
                        {whosOut.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Nobody is scheduled to be away.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {whosOut.slice(0, 6).map(w => (
                                    <li
                                        key={`${w.person_id}-${w.start_date}`}
                                        className="flex items-center justify-between text-sm"
                                    >
                                        <span className="text-slate-600 dark:text-slate-300">
                                            {w.full_name ?? 'A colleague'}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {w.start_date === w.end_date
                                                ? w.start_date
                                                : `${w.start_date} → ${w.end_date}`}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
};

export default MyHomePage;
