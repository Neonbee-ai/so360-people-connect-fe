import React, { useEffect, useState, useCallback } from 'react';
import { CalendarClock, Clock, Coffee, LogOut, Play, Send } from 'lucide-react';
import { Button, Card, Cluster, DashboardPageTemplate, DateInput, Grid, Select, Stack, Textarea, TimePicker, toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { MyOpenSession, MyAttendanceRecord, MyAllocation } from '../../services/meService';
import { attendanceCorrectionsApi } from '../../services/attendanceService';
import type { AttendanceCorrectionRequest, AttendanceStatus } from '../../services/attendanceService';
import { MyCard, StatusPill, Skeleton } from './myUi';
import { usePeopleFormatters } from '../../utils/formatters';

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

    const heroCard = session ? (
        <Card>
            <Cluster justify="between">
                <Stack gap="tight">
                    <p className="text-nb-lg font-semibold text-fg">
                        {onBreak ? 'On break' : 'Clocked in'}
                        {session.entity_name ? (
                            <span className="font-normal text-fg-muted"> · {session.entity_name}</span>
                        ) : ''}
                    </p>
                    <p className="text-nb-sm text-fg-muted">
                        Started {elapsed(session.started_at, now)} ago
                    </p>
                </Stack>

                <Cluster>
                    {onBreak ? (
                        <Button
                            disabled={busy}
                            onClick={() => act(() => meService.endBreak(), 'Break ended')}
                        >
                            <Play size={16} /> Resume work
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => act(() => meService.startBreak(), 'Break started')}
                        >
                            <Coffee size={16} /> Take a break
                        </Button>
                    )}

                    <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => act(() => meService.clockOut(), 'Clocked out')}
                    >
                        <LogOut size={16} /> Clock out
                    </Button>
                </Cluster>
            </Cluster>
        </Card>
    ) : (
        <Card>
            <Stack gap="default">
                <p className="text-nb-lg font-semibold text-fg">You&apos;re not clocked in</p>

                {allocations.length === 0 ? (
                    // A job session must book time against a work unit, so with no
                    // assignment there is genuinely nothing to clock in to. Say that
                    // plainly rather than offering a button that cannot work.
                    <p className="text-nb-sm text-fg-subtle">
                        You have no active work assignments. Ask your supervisor to
                        assign one, then clock in here.
                    </p>
                ) : (
                    <Cluster align="end">
                        <Select
                            name="clock-in-allocation"
                            label="What are you working on?"
                            value={picked}
                            onChange={e => setPicked(e.target.value)}
                            options={[
                                { value: '', label: 'Select a job…' },
                                ...allocations.map(a => ({
                                    value: a.id,
                                    label: `${a.entity_name || `${a.entity_type} ${a.entity_id.slice(0, 8)}`}`,
                                })),
                            ]}
                        />
                        <Button
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
                        >
                            <Play size={16} /> Clock in
                        </Button>
                    </Cluster>
                )}
            </Stack>
        </Card>
    );

    return (
        <DashboardPageTemplate
            title="My Time"
            description="Clock in, take breaks, clock out"
            primary={
                loading ? (
                    <Skeleton rows={3} />
                ) : (
                    <Stack gap="region">
                        {/* Hero clock card — the one thing this page is for. */}
                        {heroCard}

                        <CorrectionRequestsCard corrections={corrections} onFiled={load} />

                        <MyCard title="My attendance" icon={<Clock size={14} />}>
                            {history.length === 0 ? (
                                <p className="text-nb-sm text-fg-subtle">No attendance recorded yet.</p>
                            ) : (
                                <Stack gap="tight">
                                    {history.slice(0, 30).map(r => (
                                        <Cluster key={r.id} justify="between">
                                            <span className="text-nb-sm text-fg">{r.attendance_date}</span>
                                            <StatusPill status={r.status} />
                                        </Cluster>
                                    ))}
                                </Stack>
                            )}
                        </MyCard>
                    </Stack>
                )
            }
        />
    );
};

// =============================================================================
// Attendance correction requests — "I was there, the register is wrong"
// =============================================================================

const CORRECTION_STATUSES: AttendanceStatus[] = ['present', 'half_day', 'wfh', 'on_duty'];

const CorrectionRequestsCard: React.FC<{
    corrections: AttendanceCorrectionRequest[];
    onFiled: () => Promise<void> | void;
}> = ({ corrections, onFiled }) => {
    const formatters = usePeopleFormatters();
    const [open, setOpen] = useState(false);
    // Org business date, not the UTC day — an employee filing a correction just
    // after local midnight would otherwise default to the previous day.
    const [date, setDate] = useState(() => formatters.businessToday());
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
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(v => !v)}>
                    {open ? 'Close' : 'Request correction'}
                </Button>
            }
        >
            <Stack gap="default">
                {open && (
                    <form onSubmit={submit}>
                        <Stack gap="default">
                            <Grid columns={2}>
                                <DateInput
                                    name="correction-date"
                                    label="Date"
                                    max={formatters.businessToday()}
                                    value={date}
                                    onChange={iso => setDate(iso)}
                                    required
                                />
                                <Select
                                    name="correction-status"
                                    label="Correct status"
                                    value={status}
                                    onChange={e => setStatus(e.target.value as AttendanceStatus)}
                                    options={CORRECTION_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
                                />
                                <TimePicker
                                    name="correction-check-in"
                                    label="Check in"
                                    value={checkIn}
                                    onChange={setCheckIn}
                                />
                                <TimePicker
                                    name="correction-check-out"
                                    label="Check out"
                                    value={checkOut}
                                    onChange={setCheckOut}
                                />
                            </Grid>
                            <Textarea
                                name="correction-reason"
                                label="Reason"
                                required
                                rows={2}
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder="e.g. I was on site but forgot to punch in"
                            />
                            <Cluster justify="end">
                                <Button type="submit" disabled={saving || !reason.trim()}>
                                    <Send size={16} /> Submit request
                                </Button>
                            </Cluster>
                        </Stack>
                    </form>
                )}

                {corrections.length === 0 ? (
                    <p className="text-nb-sm text-fg-subtle">
                        No correction requests yet. Spotted a wrong or missing day? Request a correction.
                    </p>
                ) : (
                    <Stack gap="default">
                        {corrections.slice(0, 30).map(c => (
                            <Stack key={c.id} gap="tight">
                                <Cluster justify="between">
                                    <span className="text-nb-sm text-fg">{c.attendance_date}</span>
                                    <span className="text-nb-sm text-fg-subtle">
                                        {[c.requested_check_in, c.requested_check_out].filter(Boolean).join(' – ') || c.requested_status || ''}
                                    </span>
                                    <StatusPill status={c.status} />
                                </Cluster>
                                <p className="text-nb-sm text-fg-subtle">{c.reason}</p>
                                {c.status === 'rejected' && c.review_note && (
                                    <p className="text-nb-sm text-danger">Rejected: {c.review_note}</p>
                                )}
                            </Stack>
                        ))}
                    </Stack>
                )}
            </Stack>
        </MyCard>
    );
};

export default MyTimePage;
