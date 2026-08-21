import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Check, Search, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { meService } from '../../services/meService';
import type { WhosOutEntry, DirectoryEntry, TeamLeaveRequest } from '../../services/meService';
import {
    Avatar,
    MyCard,
    Skeleton,
    StatusPill,
    dangerBtn,
    inputCls,
    primaryBtn,
    secondaryBtn,
} from './myUi';

/**
 * My Team — Who's Out and the colleague directory.
 *
 * This is the deliberate, redacted replacement for showing employees the admin
 * Leave Calendar. An employee has a real need to know who is away in order to
 * plan work, which is why every mature HR product ships this view. They have
 * no business seeing WHY: no reason, no attachments, no approval thread, and
 * no leave type (sick vs casual is medical-adjacent information about a
 * colleague). The backend enforces that redaction — this page cannot render
 * what it is never sent.
 */

const todayIso = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
};

const MyTeamPage: React.FC = () => {
    const [tab, setTab] = useState<'out' | 'directory'>('out');
    const [whosOut, setWhosOut] = useState<WhosOutEntry[]>([]);
    const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Manager tier. The endpoint returns [] for anyone who heads no
    // department, so an empty list means the whole section simply does not
    // exist for this employee — no error state, no locked card.
    const [teamLeave, setTeamLeave] = useState<TeamLeaveRequest[]>([]);
    const [actingId, setActingId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const [w, d, t] = await Promise.allSettled([
            meService.whosOut(todayIso(), inDays(30)),
            meService.directory(),
            meService.myTeamLeaveRequests({ status: 'pending' }),
        ]);
        if (w.status === 'fulfilled') setWhosOut(w.value.data);
        if (d.status === 'fulfilled') setDirectory(d.value.data);
        if (t.status === 'fulfilled') setTeamLeave(t.value.data);
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const approve = async (id: string) => {
        setActingId(id);
        try {
            await meService.approveTeamLeaveRequest(id);
            setTeamLeave(prev => prev.filter(r => r.id !== id));
        } finally {
            setActingId(null);
        }
    };

    const confirmReject = async (id: string) => {
        const reason = rejectReason.trim();
        if (!reason) return;
        setActingId(id);
        try {
            await meService.rejectTeamLeaveRequest(id, reason);
            setTeamLeave(prev => prev.filter(r => r.id !== id));
            setRejectingId(null);
            setRejectReason('');
        } finally {
            setActingId(null);
        }
    };

    const filtered = directory.filter(p =>
        p.full_name?.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="My Team" subtitle="Who's away, and who to contact" />

            {/* Team Leave — rendered ONLY for department heads with pending
                requests. The backend returns [] for everyone else, so absence
                of the card is the normal employee experience. */}
            {!loading && teamLeave.length > 0 && (
                <MyCard title="Team leave approvals" icon={<Calendar size={14} />} flush>
                    <ul className="divide-y divide-slate-800">
                        {teamLeave.map(r => (
                            <li key={r.id} className="space-y-2 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Avatar name={r.person?.full_name} />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm text-slate-50">
                                                {r.person?.full_name ?? 'A team member'}
                                            </p>
                                            <p className="truncate text-xs text-slate-500">
                                                {r.start_date === r.end_date
                                                    ? r.start_date
                                                    : `${r.start_date} → ${r.end_date}`}
                                                {r.leave_type?.name ? ` · ${r.leave_type.name}` : ''}
                                            </p>
                                            {r.reason && (
                                                <p className="mt-0.5 truncate text-xs text-slate-400">
                                                    {r.reason}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <StatusPill status={r.status} />
                                        <button
                                            onClick={() => void approve(r.id)}
                                            disabled={actingId === r.id}
                                            className={`${primaryBtn} !px-3 !py-1.5 !text-xs`}
                                        >
                                            <Check size={12} /> Approve
                                        </button>
                                        <button
                                            onClick={() => {
                                                setRejectingId(prev => (prev === r.id ? null : r.id));
                                                setRejectReason('');
                                            }}
                                            disabled={actingId === r.id}
                                            className={`${dangerBtn} !px-3 !py-1.5 !text-xs`}
                                        >
                                            <X size={12} /> Reject
                                        </button>
                                    </div>
                                </div>
                                {rejectingId === r.id && (
                                    <div className="flex items-center gap-2 pl-11">
                                        <input
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                            placeholder="Reason for rejection (required)"
                                            className={inputCls}
                                            aria-label="Rejection reason"
                                        />
                                        <button
                                            onClick={() => void confirmReject(r.id)}
                                            disabled={!rejectReason.trim() || actingId === r.id}
                                            className={`${dangerBtn} !px-3 !py-1.5 !text-xs shrink-0`}
                                        >
                                            Confirm reject
                                        </button>
                                        <button
                                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                            className={`${secondaryBtn} !px-3 !py-1.5 !text-xs shrink-0`}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </MyCard>
            )}

            <div className="flex gap-1 border-b border-slate-800">
                {(['out', 'directory'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            tab === t
                                ? 'border-b-2 border-teal-500 text-teal-400'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {t === 'out' ? "Who's out" : 'Directory'}
                    </button>
                ))}
            </div>

            {loading ? (
                <Skeleton rows={3} />
            ) : tab === 'out' ? (
                whosOut.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500">
                        Nobody is scheduled to be away in the next 30 days.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
                        {whosOut.map(w => (
                            <li
                                key={`${w.person_id}-${w.start_date}`}
                                className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <Avatar name={w.full_name} />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm text-slate-50">
                                            {w.full_name ?? 'A colleague'}
                                        </p>
                                        {w.job_title && (
                                            <p className="truncate text-xs text-slate-500">
                                                {w.job_title}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span className="shrink-0 text-xs text-slate-500">
                                    {w.start_date === w.end_date
                                        ? w.start_date
                                        : `${w.start_date} → ${w.end_date}`}
                                </span>
                            </li>
                        ))}
                    </ul>
                )
            ) : (
                <>
                    <div className="relative">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search colleagues"
                            className={`${inputCls} pl-9`}
                        />
                    </div>

                    {filtered.length === 0 ? (
                        <p className="py-10 text-center text-sm text-slate-500">
                            No colleagues found.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
                            {filtered.map(p => (
                                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Avatar name={p.full_name} />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm text-slate-50">
                                                {p.full_name}
                                            </p>
                                            {p.job_title && (
                                                <p className="truncate text-xs text-slate-500">
                                                    {p.job_title}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {p.email && (
                                        <a
                                            href={`mailto:${p.email}`}
                                            className="shrink-0 text-xs text-teal-400 hover:text-teal-300"
                                        >
                                            {p.email}
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
};

export default MyTeamPage;
