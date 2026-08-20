import React, { useEffect, useState, useCallback } from 'react';
import { Clock, Coffee, LogOut, Play } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { MyOpenSession, MyAttendanceRecord, MyAllocation } from '../../services/meService';

/**
 * My Time — clock in, breaks, clock out, and my own attendance history.
 *
 * The platform has granted every default Employee role `job_sessions.clock`
 * since Crew P1 shipped, and the backend has had clock-in/out/break endpoints
 * that whole time — but no web frontend ever referenced them. Employees held a
 * permission the product gave them no way to exercise. This is that surface.
 *
 * The underlying job-sessions API takes person_id in the body; these calls go
 * through /me/session/* instead, where the person is forced from the session,
 * so this page cannot clock a colleague in or out.
 */

const elapsed = (fromIso: string, now: number): string => {
    const ms = now - new Date(fromIso).getTime();
    if (Number.isNaN(ms) || ms < 0) return '0m';
    const mins = Math.floor(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const MyTimePage: React.FC = () => {
    const [session, setSession] = useState<MyOpenSession | null>(null);
    const [allocations, setAllocations] = useState<MyAllocation[]>([]);
    const [picked, setPicked] = useState('');
    const [history, setHistory] = useState<MyAttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(Date.now());

    const load = useCallback(async () => {
        const [s, a, al] = await Promise.allSettled([
            meService.myOpenSession(),
            meService.myAttendance(),
            meService.myAllocations(),
        ]);
        if (s.status === 'fulfilled') setSession(s.value.session);
        if (a.status === 'fulfilled') setHistory(a.value.data);
        if (al.status === 'fulfilled') setAllocations(al.value.data);
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    // Keeps the running timer honest without refetching.
    useEffect(() => {
        if (!session) return;
        const t = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(t);
    }, [session]);

    const act = async (fn: () => Promise<unknown>, success: string) => {
        setBusy(true);
        try {
            await fn();
            toast.success(success);
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setBusy(false);
        }
    };

    const onBreak = !!session?.break_started_at;

    if (loading) {
        return <div className="py-12 text-center text-sm text-slate-500">Loading…</div>;
    }

    return (
        <div className="space-y-4">
            <PageHeader title="My Time" subtitle="Clock in, take breaks, clock out" />

            <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                {session ? (
                    <>
                        <div className="mb-4 flex items-center gap-3">
                            <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${
                                    onBreak ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                            />
                            <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                    {onBreak ? 'On break' : 'Clocked in'}
                                    {session.entity_name ? ` · ${session.entity_name}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Started {elapsed(session.started_at, now)} ago
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {onBreak ? (
                                <button
                                    disabled={busy}
                                    onClick={() => act(() => meService.endBreak(), 'Break ended')}
                                    className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                    <Play size={16} /> Resume work
                                </button>
                            ) : (
                                <button
                                    disabled={busy}
                                    onClick={() => act(() => meService.startBreak(), 'Break started')}
                                    className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                                >
                                    <Coffee size={16} /> Take a break
                                </button>
                            )}

                            <button
                                disabled={busy}
                                onClick={() => act(() => meService.clockOut(), 'Clocked out')}
                                className="flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                                <LogOut size={16} /> Clock out
                            </button>
                        </div>
                    </>
                ) : (
                    <div>
                        <div className="mb-4 flex items-center gap-3">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                You&apos;re not clocked in
                            </p>
                        </div>

                        {allocations.length === 0 ? (
                            // A job session must book time against a work unit, so with no
                            // assignment there is genuinely nothing to clock in to. Say that
                            // plainly rather than offering a button that cannot work.
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                You have no active work assignments. Ask your supervisor to
                                assign one, then clock in here.
                            </p>
                        ) : (
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="min-w-[220px] flex-1">
                                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                                        What are you working on?
                                    </label>
                                    <select
                                        value={picked}
                                        onChange={e => setPicked(e.target.value)}
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                                    >
                                        <option value="">Select a job…</option>
                                        {allocations.map(a => (
                                            <option key={a.id} value={a.id}>
                                                {a.entity_name || `${a.entity_type} ${a.entity_id.slice(0, 8)}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    disabled={busy || !picked}
                                    onClick={() => {
                                        const a = allocations.find(x => x.id === picked);
                                        if (!a) return;
                                        void act(
                                            () => meService.clockIn({
                                                entity_type: a.entity_type,
                                                entity_id: a.entity_id,
                                                entity_name: a.entity_name ?? undefined,
                                            }),
                                            'Clocked in',
                                        );
                                    }}
                                    className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                    <Play size={16} /> Clock in
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        My attendance
                    </h2>
                </div>
                {history.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        No attendance recorded yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                        {history.slice(0, 30).map(r => (
                            <li key={r.id} className="flex items-center justify-between px-4 py-2.5">
                                <span className="text-sm text-slate-700 dark:text-slate-200">
                                    {r.attendance_date}
                                </span>
                                <span className="text-xs capitalize text-slate-500 dark:text-slate-400">
                                    {r.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default MyTimePage;
