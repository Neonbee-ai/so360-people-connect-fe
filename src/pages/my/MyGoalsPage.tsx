import React, { useEffect, useState, useCallback } from 'react';
import { Target } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { meService } from '../../services/meService';
import type { MyGoal } from '../../services/meService';

/**
 * My Goals.
 *
 * Read-only for now, and deliberately so: the admin Goals page writes
 * `person_id: apiContext.getUserId()` — a USER id in a PERSON field, which are
 * different identifiers. Rather than copy that bug into the employee surface,
 * this page shows the employee's real goals and progress updates stay with the
 * admin flow until that write path is corrected.
 */

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const MyGoalsPage: React.FC = () => {
    const [goals, setGoals] = useState<MyGoal[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await meService.myGoals();
            setGoals(res.data);
        } catch {
            setGoals([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    return (
        <div className="space-y-4">
            <PageHeader title="My Goals" subtitle="What you're working towards" />

            {loading ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
            ) : goals.length === 0 ? (
                <EmptyState
                    icon={Target}
                    title="No goals yet"
                    description="Goals set for you by your manager will appear here."
                />
            ) : (
                <ul className="space-y-3">
                    {goals.map(g => (
                        <li
                            key={g.id}
                            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
                        >
                            <div className="mb-2 flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                        {g.title}
                                    </p>
                                    {g.description && (
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            {g.description}
                                        </p>
                                    )}
                                </div>
                                <span
                                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium capitalize ${
                                        STATUS_STYLES[g.status] ?? STATUS_STYLES.draft
                                    }`}
                                >
                                    {g.status}
                                </span>
                            </div>

                            <div className="mt-3">
                                <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                    <span>Progress</span>
                                    <span>{g.progress_percentage ?? 0}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                    <div
                                        className="h-full rounded-full bg-blue-600"
                                        style={{ width: `${Math.min(100, Math.max(0, g.progress_percentage ?? 0))}%` }}
                                    />
                                </div>
                            </div>

                            {g.target_date && (
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Target: {g.target_date}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MyGoalsPage;
