import React, { useEffect, useState, useCallback } from 'react';
import { CalendarDays, Target, Users, Inbox } from 'lucide-react';
import { Cluster, DashboardPageTemplate, Grid, Stack } from '@so360/design-system';
import { meService } from '../../services/meService';
import type { MyLeaveBalance, MyGoal, WhosOutEntry } from '../../services/meService';
import type { LeaveRequest } from '../../services/leaveRequestsService';
import { MyCard, StatusPill, ProgressBar, Avatar, Skeleton } from './myUi';
import MyOnboardingCard from './MyOnboardingCard';

/**
 * The employee's landing page.
 *
 * People Connect had no employee surface at all — an employee was dropped into
 * the administrator's application with some menu items hidden, so the answer to
 * "what's happening with me?" lived nowhere. This page is that answer: my
 * balance, my open requests, my goals, and who is away.
 *
 * Every read goes through /me/*, so nothing here can show another person's row
 * regardless of what permissions the viewer's role happens to carry.
 */

const todayIso = () => new Date().toISOString().slice(0, 10);

const inDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

const MyHomePage: React.FC = () => {
    const [balances, setBalances] = useState<MyLeaveBalance[]>([]);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [goals, setGoals] = useState<MyGoal[]>([]);
    const [whosOut, setWhosOut] = useState<WhosOutEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        // Each panel is independent: one failing source should degrade that
        // card, not blank the whole page.
        const [b, r, g, w] = await Promise.allSettled([
            meService.myLeaveBalances(new Date().getFullYear()),
            meService.myLeaveRequests({ limit: 5 }),
            meService.myGoals({ status: 'active' }),
            meService.whosOut(todayIso(), inDays(7)),
        ]);

        if (b.status === 'fulfilled') setBalances(b.value.data);
        if (r.status === 'fulfilled') setRequests(r.value.data);
        if (g.status === 'fulfilled') setGoals(g.value.data);
        if (w.status === 'fulfilled') setWhosOut(w.value.data);
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const pending = requests.filter(r => r.status === 'pending');

    const muted = 'text-nb-sm text-fg-subtle';

    return (
        <DashboardPageTemplate
            title="Overview"
            description="Your leave, goals and team at a glance"
            kpis={
                /* Only renders while an onboarding instance is active — fetches
                   independently so it can never degrade the panels below. */
                <MyOnboardingCard />
            }
            primary={
                loading ? (
                    <Grid columns={2}>
                        <Skeleton rows={2} />
                        <Skeleton rows={2} />
                    </Grid>
                ) : (
                    <Grid columns={2}>
                        <MyCard
                            title="My leave balance"
                            icon={<CalendarDays size={14} />}
                            to="/people/my/leave"
                        >
                            {balances.length === 0 ? (
                                <p className={muted}>No leave balances have been set up for you yet.</p>
                            ) : (
                                <Stack gap="tight">
                                    {balances.map(b => (
                                        <Cluster key={b.id} justify="between">
                                            <span className="text-nb-sm text-fg">{b.leave_type?.name ?? 'Leave'}</span>
                                            <span className="text-nb-sm font-semibold text-fg">{b.available} days</span>
                                        </Cluster>
                                    ))}
                                </Stack>
                            )}
                        </MyCard>

                        <MyCard title="My requests" icon={<Inbox size={14} />} to="/people/my/leave">
                            {requests.length === 0 ? (
                                <p className={muted}>You haven&apos;t requested any leave yet.</p>
                            ) : (
                                <Stack gap="tight">
                                    {pending.length > 0 && (
                                        <p className="text-nb-sm text-warning">{pending.length} awaiting approval</p>
                                    )}
                                    {requests.slice(0, 4).map(r => (
                                        <Cluster key={r.id} justify="between">
                                            <span className="text-nb-sm text-fg">
                                                {r.start_date} → {r.end_date}
                                            </span>
                                            <StatusPill status={r.status} />
                                        </Cluster>
                                    ))}
                                </Stack>
                            )}
                        </MyCard>

                        <MyCard title="My goals" icon={<Target size={14} />} to="/people/my/goals">
                            {goals.length === 0 ? (
                                <p className={muted}>No active goals.</p>
                            ) : (
                                <Stack gap="default">
                                    {goals.slice(0, 4).map(g => (
                                        <Stack key={g.id} gap="tight">
                                            <Cluster justify="between">
                                                <span className="truncate text-nb-sm text-fg">{g.title}</span>
                                                <span className={muted}>{g.progress_percentage ?? 0}%</span>
                                            </Cluster>
                                            <ProgressBar percent={g.progress_percentage ?? 0} />
                                        </Stack>
                                    ))}
                                </Stack>
                            )}
                        </MyCard>

                        <MyCard title="Who's out this week" icon={<Users size={14} />}>
                            {whosOut.length === 0 ? (
                                <p className={muted}>Nobody is scheduled to be away.</p>
                            ) : (
                                <Stack gap="tight">
                                    {whosOut.slice(0, 6).map(w => (
                                        <Cluster key={`${w.person_id}-${w.start_date}`} justify="between">
                                            <Cluster>
                                                <Avatar name={w.full_name} />
                                                <span className="truncate text-nb-sm text-fg">
                                                    {w.full_name ?? 'A colleague'}
                                                </span>
                                            </Cluster>
                                            <span className={muted}>
                                                {w.start_date === w.end_date
                                                    ? w.start_date
                                                    : `${w.start_date} → ${w.end_date}`}
                                            </span>
                                        </Cluster>
                                    ))}
                                </Stack>
                            )}
                        </MyCard>
                    </Grid>
                )
            }
        />
    );
};

export default MyHomePage;
