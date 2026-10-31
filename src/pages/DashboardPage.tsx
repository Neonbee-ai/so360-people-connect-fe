import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessSettings, useShellBridge } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import {
    Users, Clock, Target, DollarSign, ArrowRight, UserPlus, UserMinus,
} from 'lucide-react';
import {
    DashboardPageTemplate, KpiCard, Card, Grid, GridItem, Stack, Cluster, Button, Badge, Alert,
} from '@so360/design-system';
import StatusBadge from '../components/StatusBadge';
import { utilizationApi, eventsApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import type { TimesheetEntry } from '../services/timesheetApi';
import type { UtilizationSummary, PeopleEvent, DepartmentHeadcountEntry } from '../types/people';

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const shell = useShellBridge() as any;
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });

    const canViewCost = shell?.isAdmin ||
        (shell?.hasAnyPermission && shell.hasAnyPermission('dashboard.financial_kpis', 'compensation.read', 'payroll.read')) ||
        (shell?.hasPermission && (shell.hasPermission('dashboard.financial_kpis') || shell.hasPermission('compensation.read') || shell.hasPermission('payroll.read')));
    const [summary, setSummary] = useState<UtilizationSummary | null>(null);
    const [recentEntries, setRecentEntries] = useState<TimesheetEntry[]>([]);
    const [recentEvents, setRecentEvents] = useState<PeopleEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            // Promise.allSettled so that a down Timesheet service (port 3012) does
            // not block the summary KPIs — each call fails independently.
            const [summaryResult, entriesResult, eventsResult] = await Promise.allSettled([
                utilizationApi.getSummary(),
                timesheetApi.getEntries({ limit: 5 }),
                eventsApi.getAll({ limit: 8 }),
            ]);
            if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
            else console.error('Dashboard summary error:', summaryResult.reason);
            if (entriesResult.status === 'fulfilled') setRecentEntries(entriesResult.value.data);
            if (eventsResult.status === 'fulfilled') setRecentEvents(eventsResult.value.data);
            setLoading(false);
        };
        loadData();
    }, []);

    const eventTypeLabels: Record<string, string> = {
        person_allocated: 'Allocated',
        time_logged: 'Time Logged',
        timesheet_approved: 'Approved',
        person_created: 'New Person',
        person_released: 'Released',
    };

    const formatCurrency = (amount: number) => formatters.formatCurrency(amount);

    const payloadOf = (event: PeopleEvent) => event.payload as Record<string, unknown> | undefined;
    const showAlert = !!summary && (summary.avg_utilization_pct < 50 || summary.pending_approvals > 3);

    const kpis = [
        <KpiCard key="people" name="active-people" label="Active People" value={summary?.total_people || 0} icon={Users} loading={loading} />,
        <KpiCard key="util" name="avg-utilization" label="Avg Utilization" value={`${summary?.avg_utilization_pct || 0}%`} icon={Target} loading={loading} />,
        <KpiCard key="hours" name="hours-this-week" label="Hours This Week" value={summary?.total_hours_this_week || 0} icon={Clock} loading={loading} />,
    ];
    if (canViewCost) {
        kpis.push(
            <KpiCard key="burn" name="weekly-burn-rate" label="Weekly Burn Rate" value={formatCurrency(summary?.total_cost_this_week || 0)} icon={DollarSign} loading={loading} />,
        );
    }

    return (
        <DashboardPageTemplate
            title="People Connect"
            description="Resource control, allocation, and utilization intelligence"
            primaryAction={(
                <Button type="button" onClick={() => navigate('/people/people', { state: { openCreate: true } })}>
                    <UserPlus className="w-4 h-4" /> Add Person
                </Button>
            )}
            kpis={kpis}
            primary={(
                <Stack gap="region">
                    <Grid columns="auto" gap="lg">
                        <GridItem span={4}>
                            <Card title="Active Allocations">
                                <p className="text-nb-xl font-bold text-fg">{summary?.active_allocations || 0}</p>
                            </Card>
                        </GridItem>
                        <GridItem span={4}>
                            <Card title="Pending Approvals">
                                <Stack gap="tight">
                                    <p className="text-nb-xl font-bold text-fg">{summary?.pending_approvals || 0}</p>
                                    {summary && summary.pending_approvals > 0 && (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/people/time')}>
                                            Review now <ArrowRight className="w-3 h-3" />
                                        </Button>
                                    )}
                                </Stack>
                            </Card>
                        </GridItem>
                        <GridItem span={4}>
                            <Card title="Daily Burn Rate">
                                <p className="text-nb-xl font-bold text-fg">{formatCurrency(summary?.burn_rate_daily || 0)}</p>
                            </Card>
                        </GridItem>
                    </Grid>

                    <Grid columns="auto" gap="lg">
                        <GridItem span={6}>
                            <Card
                                title="Recent Timesheet Entries"
                                actions={(
                                    <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/people/time')}>
                                        View all <ArrowRight className="w-3 h-3" />
                                    </Button>
                                )}
                            >
                                {recentEntries.length === 0 ? (
                                    <p className="text-nb-sm text-fg-subtle text-center">No time entries yet</p>
                                ) : (
                                    <Stack gap="default">
                                        {recentEntries.map((entry) => (
                                            <Cluster key={entry.id} gap="default" align="center" justify="between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-nb-sm text-fg truncate">{entry.entity_name || entry.entity_type || 'Time entry'}</div>
                                                    <div className="text-nb-xs text-fg-subtle truncate">
                                                        {entry.entry_date} - {entry.description || 'No description'}
                                                    </div>
                                                </div>
                                                <Cluster gap="default" align="center">
                                                    <span className="text-nb-sm font-medium text-fg">{entry.hours}h</span>
                                                    <StatusBadge status={entry.status} />
                                                </Cluster>
                                            </Cluster>
                                        ))}
                                    </Stack>
                                )}
                            </Card>
                        </GridItem>

                        <GridItem span={6}>
                            <Card title="Activity Feed">
                                {recentEvents.length === 0 ? (
                                    <p className="text-nb-sm text-fg-subtle text-center">No events yet</p>
                                ) : (
                                    <Stack gap="default">
                                        {recentEvents.map((event) => {
                                            const payload = payloadOf(event);
                                            return (
                                                <div key={event.id}>
                                                    <Cluster gap="tight" align="center">
                                                        <span className="text-nb-xs font-medium text-primary">
                                                            {eventTypeLabels[event.event_type] || event.event_type}
                                                        </span>
                                                        <span className="text-nb-xs text-fg-subtle">by</span>
                                                        <span className="text-nb-xs text-fg-muted">{event.actor_name || 'System'}</span>
                                                    </Cluster>
                                                    <div className="text-nb-xs text-fg-subtle">
                                                        {payload && typeof payload === 'object' && (
                                                            <>
                                                                {payload.entity_name && <span>{String(payload.entity_name)}</span>}
                                                                {payload.full_name && <span>{String(payload.full_name)}</span>}
                                                                {payload.hours && <span> - {String(payload.hours)}h</span>}
                                                            </>
                                                        )}
                                                        <span className="ml-2 text-fg-subtle">{formatters.formatDate(event.occurred_at)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </Card>
                        </GridItem>
                    </Grid>
                </Stack>
            )}
            secondary={(
                <Stack gap="region">
                    <Card title="Department Headcount">
                        {!summary?.department_headcount?.length ? (
                            <p className="text-nb-sm text-fg-subtle text-center">No departments yet</p>
                        ) : (
                            <Stack gap="tight">
                                {summary.department_headcount.map((dept: DepartmentHeadcountEntry) => (
                                    <Cluster key={dept.name} gap="default" align="center" justify="between">
                                        <span className="text-nb-sm text-fg truncate">{dept.name}</span>
                                        <span className="text-nb-sm font-semibold text-fg">{dept.count}</span>
                                    </Cluster>
                                ))}
                            </Stack>
                        )}
                    </Card>

                    <Card title="Leave Overview">
                        <Stack gap="default">
                            <Cluster gap="default" align="center" justify="between">
                                <span className="text-nb-sm text-fg-muted">On Leave Today</span>
                                <Badge tone="danger">{summary?.on_leave_today_count ?? 0}</Badge>
                            </Cluster>
                            <Cluster gap="default" align="center" justify="between">
                                <span className="text-nb-sm text-fg-muted">Pending Requests</span>
                                <Badge tone="warning">{summary?.pending_leave_count ?? 0}</Badge>
                            </Cluster>
                            <Cluster gap="default" align="center" justify="between">
                                <span className="text-nb-sm text-fg-muted">Approved (Upcoming)</span>
                                <Badge tone="success">{summary?.approved_leave_count ?? 0}</Badge>
                            </Cluster>
                            {summary && summary.pending_leave_count > 0 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/people/leaves')}>
                                    Review pending <ArrowRight className="w-3 h-3" />
                                </Button>
                            )}
                        </Stack>
                    </Card>

                    <Card title="Resource Availability">
                        <Stack gap="default">
                            <Cluster gap="default" align="center" justify="between">
                                <span className="text-nb-sm text-fg-muted">Available</span>
                                <Badge tone="success">{summary?.available_resources ?? 0}</Badge>
                            </Cluster>
                            <Cluster gap="default" align="center" justify="between">
                                <span className="text-nb-sm text-fg-muted">Allocated</span>
                                <Badge tone="primary">{summary?.fully_allocated_resources ?? 0}</Badge>
                            </Cluster>
                            <Cluster gap="default" align="center" justify="between">
                                <span className="text-nb-sm text-fg-muted">Overallocated</span>
                                <Badge tone="danger">{summary?.overallocated_resources ?? 0}</Badge>
                            </Cluster>
                            {summary && summary.overallocated_resources > 0 && (
                                <Cluster gap="tight" align="center">
                                    <UserMinus className="w-3 h-3 text-danger" />
                                    <span className="text-nb-xs text-danger">{summary.overallocated_resources} resource{summary.overallocated_resources > 1 ? 's' : ''} over capacity</span>
                                </Cluster>
                            )}
                        </Stack>
                    </Card>
                </Stack>
            )}
            bottom={showAlert ? (
                <Alert variant="warning" title="Attention Required">
                    {summary!.avg_utilization_pct < 50 && (
                        <span>Average utilization is below 50%. Consider reviewing resource allocations. </span>
                    )}
                    {summary!.pending_approvals > 3 && (
                        <span>{summary!.pending_approvals} time entries awaiting approval.</span>
                    )}
                </Alert>
            ) : undefined}
        />
    );
};

export default DashboardPage;
