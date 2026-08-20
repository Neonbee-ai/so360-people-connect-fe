import React, { useEffect, useState, useCallback } from 'react';
import { Clock, Coffee, LogOut, Play } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { MyOpenSession, MyAttendanceRecord, MyAllocation } from '../../services/meService';
import { MyCard, StatusPill, Skeleton, primaryBtn, secondaryBtn, dangerBtn, inputCls, labelCls } from './myUi';

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
        return (
            <div className="p-6 space-y-5">
                <PageHeader title="My Time" subtitle="Clock in, take breaks, clock out" />
                <Skeleton rows={3} />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="My Time" subtitle="Clock in, take breaks, clock out" />

            {/* Hero clock card — the one thing this page is for. */}
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                {session ? (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <span className="relative flex h-3 w-3">
                                <span
                                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                                        onBreak ? 'bg-amber-400' : 'bg-emerald-400'
                                    }`}
                                />
                                <span
                                    className={`relative inline-flex h-3 w-3 rounded-full ${
                                        onBreak ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                />
                            </span>
                            <div>
                                <p className="text-lg font-semibold text-slate-50">
                                    {onBreak ? 'On break' : 'Clocked in'}
                                    {session.entity_name ? (
                                        <span className="font-normal text-slate-400"> · {session.entity_name}</span>
                                    ) : ''}
                                </p>
                                <p className="text-sm text-slate-400">
                                    Started {elapsed(session.started_at, now)} ago
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {onBreak ? (
                                <button
                                    disabled={busy}
                                    onClick={() => act(() => meService.endBreak(), 'Break ended')}
                                    className={primaryBtn}
                                >
                                    <Play size={16} /> Resume work
                                </button>
                            ) : (
                                <button
                                    disabled={busy}
                                    onClick={() => act(() => meService.startBreak(), 'Break started')}
                                    className={secondaryBtn}
                                >
                                    <Coffee size={16} /> Take a break
                                </button>
                            )}

                            <button
                                disabled={busy}
                                onClick={() => act(() => meService.clockOut(), 'Clocked out')}
                                className={dangerBtn}
                            >
                                <LogOut size={16} /> Clock out
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="mb-4 flex items-center gap-3">
                            <span className="inline-block h-3 w-3 rounded-full bg-slate-600" />
                            <p className="text-lg font-semibold text-slate-50">
                                You&apos;re not clocked in
                            </p>
                        </div>

                        {allocations.length === 0 ? (
                            // A job session must book time against a work unit, so with no
                            // assignment there is genuinely nothing to clock in to. Say that
                            // plainly rather than offering a button that cannot work.
                            <p className="text-sm text-slate-500">
                                You have no active work assignments. Ask your supervisor to
                                assign one, then clock in here.
                            </p>
                        ) : (
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="min-w-[220px] flex-1">
                                    <label className={labelCls}>What are you working on?</label>
                                    <select
                                        value={picked}
                                        onChange={e => setPicked(e.target.value)}
                                        className={inputCls}
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
                                    className={primaryBtn}
                                >
                                    <Play size={16} /> Clock in
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <MyCard title="My attendance" icon={<Clock size={14} />} flush>
                {history.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                        No attendance recorded yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-800">
                        {history.slice(0, 30).map(r => (
                            <li key={r.id} className="flex items-center justify-between px-4 py-2.5">
                                <span className="text-sm text-slate-300">
                                    {r.attendance_date}
                                </span>
                                <StatusPill status={r.status} />
                            </li>
                        ))}
                    </ul>
                )}
            </MyCard>
        </div>
    );
};

export default MyTimePage;
