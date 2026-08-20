import React, { useEffect, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { meService } from '../../services/meService';
import type { WhosOutEntry, DirectoryEntry } from '../../services/meService';
import { Avatar, Skeleton, inputCls } from './myUi';

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

    const load = useCallback(async () => {
        setLoading(true);
        const [w, d] = await Promise.allSettled([
            meService.whosOut(todayIso(), inDays(30)),
            meService.directory(),
        ]);
        if (w.status === 'fulfilled') setWhosOut(w.value.data);
        if (d.status === 'fulfilled') setDirectory(d.value.data);
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const filtered = directory.filter(p =>
        p.full_name?.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="My Team" subtitle="Who's away, and who to contact" />

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
