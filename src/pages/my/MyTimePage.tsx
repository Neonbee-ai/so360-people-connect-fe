import React, { useEffect, useState, useCallback } from 'react';
import { CalendarClock, Clock, Coffee, LogOut, Play, Send } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { MyOpenSession, MyAttendanceRecord, MyAllocation } from '../../services/meService';
import { attendanceCorrectionsApi } from '../../services/attendanceService';
import type { AttendanceCorrectionRequest, AttendanceStatus } from '../../services/attendanceService';
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
    const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(Date.now());

    const load = useCallback(async () => {
        const [s, a, al, c] = await Promise.allSettled([
            meService.myOpenSession(),
            meService.myAttendance(),
            meService.myAllocations(),
            attendanceCorrectionsApi.listMine(),
        ]);
        if (s.status === 'fulfilled') setSession(s.value.session);
        if (a.status === 'fulfilled') setHistory(a.value.data);
        if (al.status === 'fulfilled') setAllocations(al.value.data);
        if (c.status === 'fulfilled') setCorrections(c.value.data);
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

            <CorrectionRequestsCard
                corrections={corrections}
                onFiled={load}
            />

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

// =============================================================================
// Attendance correction requests — "I was there, the register is wrong"
// =============================================================================

const todayIso = () => new Date().toISOString().split('T')[0];

const CORRECTION_STATUSES: AttendanceStatus[] = ['present', 'half_day', 'wfh', 'on_duty'];

const CorrectionRequestsCard: React.FC<{
    corrections: AttendanceCorrectionRequest[];
    onFiled: () => Promise<void> | void;
}> = ({ corrections, onFiled }) => {
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState(todayIso());
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [status, setStatus] = useState<AttendanceStatus>('present');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) return;
        setSaving(true);
        try {
            await attendanceCorrectionsApi.createMine({
                attendance_date: date,
                requested_check_in: checkIn || undefined,
                requested_check_out: checkOut || undefined,
                requested_status: status,
                reason: reason.trim(),
            });
            toast.success('Correction request submitted');
            setOpen(false);
            setCheckIn('');
            setCheckOut('');
            setReason('');
            await onFiled();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to submit correction request');
        } finally {
            setSaving(false);
        }
    };

    return (
        <MyCard
            title="Attendance corrections"
            icon={<CalendarClock size={14} />}
            actions={
                <button
                    type="button"
                    onClick={() => setOpen(v => !v)}
                    className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                >
                    {open ? 'Close' : 'Request correction'}
                </button>
            }
            flush
        >
            {open && (
                <form onSubmit={submit} className="space-y-4 border-b border-slate-800 p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="correction-date" className={labelCls}>Date *</label>
                            <input
                                id="correction-date"
                                type="date"
                                max={todayIso()}
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className={inputCls}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="correction-status" className={labelCls}>Correct status</label>
                            <select
                                id="correction-status"
                                value={status}
                                onChange={e => setStatus(e.target.value as AttendanceStatus)}
                                className={inputCls}
                            >
                                {CORRECTION_STATUSES.map(s => (
                                    <option key={s} value={s}>
                                        {s.replace(/_/g, ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="correction-check-in" className={labelCls}>Check in</label>
                            <input
                                id="correction-check-in"
                                type="time"
                                value={checkIn}
                                onChange={e => setCheckIn(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label htmlFor="correction-check-out" className={labelCls}>Check out</label>
                            <input
                                id="correction-check-out"
                                type="time"
                                value={checkOut}
                                onChange={e => setCheckOut(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="correction-reason" className={labelCls}>Reason *</label>
                        <textarea
                            id="correction-reason"
                            rows={2}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="e.g. I was on site but forgot to punch in"
                            className={inputCls}
                        />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={saving || !reason.trim()} className={primaryBtn}>
                            <Send size={16} /> Submit request
                        </button>
                    </div>
                </form>
            )}

            {corrections.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                    No correction requests yet. Spotted a wrong or missing day? Request a correction.
                </p>
            ) : (
                <ul className="divide-y divide-slate-800">
                    {corrections.slice(0, 30).map(c => (
                        <li key={c.id} className="px-4 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm text-slate-300">{c.attendance_date}</span>
                                <span className="text-xs text-slate-500">
                                    {[c.requested_check_in, c.requested_check_out].filter(Boolean).join(' – ') || c.requested_status || ''}
                                </span>
                                <StatusPill status={c.status} />
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{c.reason}</p>
                            {c.status === 'rejected' && c.review_note && (
                                <p className="mt-0.5 text-xs text-rose-400">Rejected: {c.review_note}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </MyCard>
    );
};

export default MyTimePage;
