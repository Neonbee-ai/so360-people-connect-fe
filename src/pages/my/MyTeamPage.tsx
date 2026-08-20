import React, { useEffect, useState, useCallback } from 'react';
import { Users, Search } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { meService } from '../../services/meService';
import type { WhosOutEntry, DirectoryEntry } from '../../services/meService';

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
        <div className="space-y-4">
            <PageHeader title="My Team" subtitle="Who's away, and who to contact" />

            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
                {(['out', 'directory'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-3 py-2 text-sm font-medium ${
                            tab === t
                                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                        {t === 'out' ? "Who's out" : 'Directory'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
            ) : tab === 'out' ? (
                whosOut.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                        Nobody is scheduled to be away in the next 30 days.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                        {whosOut.map(w => (
                            <li
                                key={`${w.person_id}-${w.start_date}`}
                                className="flex items-center justify-between px-4 py-3"
                            >
                                <div>
                                    <p className="text-sm text-slate-800 dark:text-slate-100">
                                        {w.full_name ?? 'A colleague'}
                                    </p>
                                    {w.job_title && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {w.job_title}
                                        </p>
                                    )}
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
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
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search colleagues"
                            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        />
                    </div>

                    {filtered.length === 0 ? (
                        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                            No colleagues found.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                            {filtered.map(p => (
                                <li key={p.id} className="flex items-center justify-between px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                            {p.full_name?.slice(0, 1).toUpperCase() ?? '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-800 dark:text-slate-100">
                                                {p.full_name}
                                            </p>
                                            {p.job_title && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {p.job_title}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {p.email && (
                                        <a
                                            href={`mailto:${p.email}`}
                                            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
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
