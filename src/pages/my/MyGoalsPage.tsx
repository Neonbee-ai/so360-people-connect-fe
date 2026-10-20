import React, { useEffect, useState, useCallback } from 'react';
import { Target } from 'lucide-react';
import { Card, Cluster, DashboardPageTemplate, Stack } from '@so360/design-system';
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
        <DashboardPageTemplate trail={[]}
            title="My Goals"
            description="What you're working towards"
            primary={
                loading ? (
                    <Skeleton rows={3} />
                ) : goals.length === 0 ? (
                    <EmptyState
                        icon={Target}
                        title="No goals yet"
                        description="Goals set for you by your manager will appear here."
                    />
                ) : (
                    <Stack gap="default">
                        {goals.map(g => (
                            <Card key={g.id} title={g.title} actions={<StatusPill status={g.status} />}>
                                <Stack gap="tight">
                                    {g.description && <p className="text-nb-sm text-fg-subtle">{g.description}</p>}
                                    <Cluster justify="between">
                                        <span className="text-nb-sm text-fg-subtle">Progress</span>
                                        <span className="text-nb-sm font-medium text-fg">{g.progress_percentage ?? 0}%</span>
                                    </Cluster>
                                    <ProgressBar percent={g.progress_percentage ?? 0} />
                                    {g.target_date && (
                                        <p className="text-nb-sm text-fg-subtle">Target: {g.target_date}</p>
                                    )}
                                </Stack>
                            </Card>
                        ))}
                    </Stack>
                )
            }
        />
    );
};

export default MyGoalsPage;
