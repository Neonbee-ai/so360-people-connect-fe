import React, { useEffect, useState, useCallback } from 'react';
import { Target } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { meService } from '../../services/meService';
import type { MyGoal } from '../../services/meService';
import { StatusPill, ProgressBar, Skeleton } from './myUi';

/**
 * My Goals.
 *
 * Read-only for now, and deliberately so: the admin Goals page writes
 * `person_id: apiContext.getUserId()` — a USER id in a PERSON field, which are
 * different identifiers. Rather than copy that bug into the employee surface,
 * this page shows the employee's real goals and progress updates stay with the
 * admin flow until that write path is corrected.
 */

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
        <div className="p-6 space-y-5">
            <PageHeader title="My Goals" subtitle="What you're working towards" />

            {loading ? (
                <Skeleton rows={3} />
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
                            className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                        >
                            <div className="mb-2 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-50">
                                        {g.title}
                                    </p>
                                    {g.description && (
                                        <p className="mt-1 text-xs text-slate-500">
                                            {g.description}
                                        </p>
                                    )}
                                </div>
                                <StatusPill status={g.status} />
                            </div>

                            <div className="mt-3">
                                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                    <span>Progress</span>
                                    <span className="font-medium text-slate-300">{g.progress_percentage ?? 0}%</span>
                                </div>
                                <ProgressBar percent={g.progress_percentage ?? 0} />
                            </div>

                            {g.target_date && (
                                <p className="mt-2 text-xs text-slate-500">
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
