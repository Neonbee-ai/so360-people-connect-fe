import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Check, X } from 'lucide-react';
import { Button, Cluster, DashboardPageTemplate, SearchInput, SegmentedControl, Stack, TextField } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { WhosOutEntry, DirectoryEntry, TeamLeaveRequest } from '../../services/meService';
import { Avatar, MyCard, Skeleton, StatusPill } from './myUi';

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

    const muted = 'text-nb-sm text-fg-subtle';

    const approvalsCard = !loading && teamLeave.length > 0 ? (
                    <MyCard title="Team leave approvals" icon={<Calendar size={14} />}>
                        <Stack gap="default">
                            {teamLeave.map(r => (
                                <Stack key={r.id} gap="tight">
                                    <Cluster justify="between" className="flex-nowrap">
                                        <Cluster className="min-w-0 flex-nowrap">
                                            <Avatar name={r.person?.full_name} />
                                            <Stack gap="tight">
                                                <p className="truncate text-nb-sm text-fg">
                                                    {r.person?.full_name ?? 'A team member'}
                                                </p>
                                                <p className={`truncate ${muted}`}>
                                                    {r.start_date === r.end_date
                                                        ? r.start_date
                                                        : `${r.start_date} → ${r.end_date}`}
                                                    {r.leave_type?.name ? ` · ${r.leave_type.name}` : ''}
                                                </p>
                                                {r.reason && (
                                                    <p className="truncate text-nb-sm text-fg-muted">{r.reason}</p>
                                                )}
                                            </Stack>
                                        </Cluster>
                                        <Cluster className="flex-nowrap shrink-0">
                                            <StatusPill status={r.status} />
                                            <Button
                                                size="sm"
                                                onClick={() => void approve(r.id)}
                                                disabled={actingId === r.id}
                                            >
                                                <Check size={12} /> Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => {
                                                    setRejectingId(prev => (prev === r.id ? null : r.id));
                                                    setRejectReason('');
                                                }}
                                                disabled={actingId === r.id}
                                            >
                                                <X size={12} /> Reject
                                            </Button>
                                        </Cluster>
                                    </Cluster>
                                    {rejectingId === r.id && (
                                        <Cluster>
                                            <TextField
                                                name={`reject-reason-${r.id}`}
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                placeholder="Reason for rejection (required)"
                                                aria-label="Rejection reason"
                                            />
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => void confirmReject(r.id)}
                                                disabled={!rejectReason.trim() || actingId === r.id}
                                            >
                                                Confirm reject
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                            >
                                                Cancel
                                            </Button>
                                        </Cluster>
                                    )}
                                </Stack>
                            ))}
                        </Stack>
                    </MyCard>
    ) : null;


    return (
        <DashboardPageTemplate trail={[]}
            title="My Team"
            description="Who's away, and who to contact"
            filters={
                <Cluster gap="default" className="flex-nowrap">
                    <SegmentedControl
                        aria-label="Team view"
                        value={tab}
                        onChange={v => setTab(v as 'out' | 'directory')}
                        options={[
                            { value: 'out', label: "Who's out" },
                            { value: 'directory', label: 'Directory' },
                        ]}
                    />
                    {tab === 'directory' && (
                        <SearchInput
                            name="colleague-search"
                            value={search}
                            onChange={setSearch}
                            placeholder="Search colleagues"
                        />
                    )}
                </Cluster>
            }
            primary={
                <Stack gap="default">
                    {approvalsCard}
                    {
                loading ? (
                    <Skeleton rows={3} />
                ) : tab === 'out' ? (
                    whosOut.length === 0 ? (
                        <p className={muted}>Nobody is scheduled to be away in the next 30 days.</p>
                    ) : (
                        <MyCard title="Who's out">
                            <Stack gap="default">
                                {whosOut.map(w => (
                                    <Cluster key={`${w.person_id}-${w.start_date}`} justify="between">
                                        <Cluster>
                                            <Avatar name={w.full_name} />
                                            <Stack gap="tight">
                                                <p className="truncate text-nb-sm text-fg">
                                                    {w.full_name ?? 'A colleague'}
                                                </p>
                                                {w.job_title && <p className={`truncate ${muted}`}>{w.job_title}</p>}
                                            </Stack>
                                        </Cluster>
                                        <span className={muted}>
                                            {w.start_date === w.end_date
                                                ? w.start_date
                                                : `${w.start_date} → ${w.end_date}`}
                                        </span>
                                    </Cluster>
                                ))}
                            </Stack>
                        </MyCard>
                    )
                ) : (
                    <Stack gap="default">
                        {filtered.length === 0 ? (
                            <p className={muted}>No colleagues found.</p>
                        ) : (
                            <MyCard title="Directory">
                                <Stack gap="default">
                                    {filtered.map(p => (
                                        <Cluster key={p.id} justify="between">
                                            <Cluster>
                                                <Avatar name={p.full_name} />
                                                <Stack gap="tight">
                                                    <p className="truncate text-nb-sm text-fg">{p.full_name}</p>
                                                    {p.job_title && (
                                                        <p className={`truncate ${muted}`}>{p.job_title}</p>
                                                    )}
                                                </Stack>
                                            </Cluster>
                                            {p.email && (
                                                <a href={`mailto:${p.email}`} className="text-nb-sm text-primary">
                                                    {p.email}
                                                </a>
                                            )}
                                        </Cluster>
                                    ))}
                                </Stack>
                            </MyCard>
                        )}
                    </Stack>
                )
                    }
                </Stack>
            }
        />
    );
};

export default MyTeamPage;
