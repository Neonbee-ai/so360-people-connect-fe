import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessSettings, useShellBridge } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import {
    Users, Clock, Target, TrendingUp,
    DollarSign, AlertTriangle, ArrowRight,
    UserPlus, CalendarClock, Activity,
    Building2, Calendar, UserCheck, UserMinus,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
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

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 w-48 bg-surface-raised rounded" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-surface-raised rounded-nb" />)}
                    </div>
                </div>
            </div>
        );
    }

    const eventTypeLabels: Record<string, string> = {
        person_allocated: 'Allocated',
        time_logged: 'Time Logged',
        timesheet_approved: 'Approved',
        person_created: 'New Person',
        person_released: 'Released',
    };

    const formatCurrency = (amount: number) => formatters.formatCurrency(amount);

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="People Connect"
                subtitle="Resource control, allocation, and utilization intelligence"
                actions={
                    <button
                        onClick={() => navigate('/people/people', { state: { openCreate: true } })}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        <UserPlus size={16} />
                        Add Person
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${canViewCost ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
                <StatCard
                    label="Active People"
                    value={summary?.total_people || 0}
                    icon={Users}
                    color="teal"
                />
                <StatCard
                    label="Avg Utilization"
                    value={`${summary?.avg_utilization_pct || 0}%`}
                    icon={Target}
                    color={summary && summary.avg_utilization_pct < 50 ? 'amber' : 'emerald'}
                />
                <StatCard
                    label="Hours This Week"
                    value={summary?.total_hours_this_week || 0}
                    icon={Clock}
                    color="blue"
                />
                {canViewCost && (
                    <StatCard
                        label="Weekly Burn Rate"
                        value={formatCurrency(summary?.total_cost_this_week || 0)}
                        icon={DollarSign}
                        color="purple"
                    />
                )}
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface border border-line rounded-nb p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-fg-muted">Active Allocations</span>
                        <Target size={16} className="text-primary" />
                    </div>
                    <div className="text-xl font-bold text-fg">{summary?.active_allocations || 0}</div>
                </div>
                <div className="bg-surface border border-line rounded-nb p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-fg-muted">Pending Approvals</span>
                        <CalendarClock size={16} className="text-warning" />
                    </div>
                    <div className="text-xl font-bold text-fg">{summary?.pending_approvals || 0}</div>
                    {summary && summary.pending_approvals > 0 && (
                        <button
                            onClick={() => navigate('/people/time')}
                            className="text-xs text-warning hover:text-warning mt-1 flex items-center gap-1"
                        >
                            Review now <ArrowRight size={12} />
                        </button>
                    )}
                </div>
                <div className="bg-surface border border-line rounded-nb p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-fg-muted">Daily Burn Rate</span>
                        <TrendingUp size={16} className="text-danger" />
                    </div>
                    <div className="text-xl font-bold text-fg">{formatCurrency(summary?.burn_rate_daily || 0)}</div>
                </div>
            </div>

            {/* Department Summary / Leave Overview / Resource Availability */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Department Summary */}
                <div className="bg-surface border border-line rounded-nb">
                    <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-fg">Department Headcount</h3>
                        <Building2 size={16} className="text-primary" />
                    </div>
                    <div className="divide-y divide-line">
                        {!summary?.department_headcount?.length ? (
                            <div className="p-6 text-center text-sm text-fg-subtle">No departments yet</div>
                        ) : (
                            summary.department_headcount.map((dept: DepartmentHeadcountEntry) => (
                                <div key={dept.name} className="px-5 py-2.5 flex items-center justify-between">
                                    <span className="text-sm text-fg truncate">{dept.name}</span>
                                    <span className="text-sm font-semibold text-fg ml-2">{dept.count}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Leave Overview */}
                <div className="bg-surface border border-line rounded-nb p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-fg">Leave Overview</h3>
                        <Calendar size={16} className="text-primary" />
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-fg-muted">On Leave Today</span>
                            <span className="text-sm font-bold text-danger">{summary?.on_leave_today_count ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-fg-muted">Pending Requests</span>
                            <span className="text-sm font-bold text-warning">{summary?.pending_leave_count ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-fg-muted">Approved (Upcoming)</span>
                            <span className="text-sm font-bold text-success">{summary?.approved_leave_count ?? 0}</span>
                        </div>
                    </div>
                    {summary && summary.pending_leave_count > 0 && (
                        <button
                            onClick={() => navigate('/people/leaves')}
                            className="w-full text-xs text-warning hover:text-warning flex items-center justify-center gap-1 pt-1"
                        >
                            Review pending <ArrowRight size={12} />
                        </button>
                    )}
                </div>

                {/* Resource Availability */}
                <div className="bg-surface border border-line rounded-nb p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-fg">Resource Availability</h3>
                        <UserCheck size={16} className="text-success" />
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-success" />
                                <span className="text-sm text-fg-muted">Available</span>
                            </div>
                            <span className="text-sm font-bold text-success">{summary?.available_resources ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <span className="text-sm text-fg-muted">Allocated</span>
                            </div>
                            <span className="text-sm font-bold text-primary">{summary?.fully_allocated_resources ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-danger" />
                                <span className="text-sm text-fg-muted">Overallocated</span>
                            </div>
                            <span className="text-sm font-bold text-danger">{summary?.overallocated_resources ?? 0}</span>
                        </div>
                    </div>
                    {summary && summary.overallocated_resources > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                            <UserMinus size={12} className="text-danger" />
                            <span className="text-xs text-danger">{summary.overallocated_resources} resource{summary.overallocated_resources > 1 ? 's' : ''} over capacity</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Time Entries */}
                <div className="bg-surface border border-line rounded-nb">
                    <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-fg">Recent Timesheet Entries</h3>
                        <button
                            onClick={() => navigate('/people/time')}
                            className="text-xs text-primary hover:text-primary flex items-center gap-1"
                        >
                            View all <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="divide-y divide-line">
                        {recentEntries.length === 0 ? (
                            <div className="p-6 text-center text-sm text-fg-subtle">No time entries yet</div>
                        ) : (
                            recentEntries.map((entry) => (
                                <div key={entry.id} className="px-5 py-3 flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-fg truncate">{entry.entity_name || entry.entity_type || 'Time entry'}</div>
                                        <div className="text-xs text-fg-subtle truncate">
                                            {entry.entry_date} - {entry.description || 'No description'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 ml-3">
                                        <span className="text-sm font-medium text-fg">{entry.hours}h</span>
                                        <StatusBadge status={entry.status} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-surface border border-line rounded-nb">
                    <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-fg">Activity Feed</h3>
                        <Activity size={16} className="text-fg-subtle" />
                    </div>
                    <div className="divide-y divide-line">
                        {recentEvents.length === 0 ? (
                            <div className="p-6 text-center text-sm text-fg-subtle">No events yet</div>
                        ) : (
                            recentEvents.map((event) => (
                                <div key={event.id} className="px-5 py-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-primary">
                                            {eventTypeLabels[event.event_type] || event.event_type}
                                        </span>
                                        <span className="text-xs text-fg-subtle">by</span>
                                        <span className="text-xs text-fg-muted">{event.actor_name || 'System'}</span>
                                    </div>
                                    <div className="text-xs text-fg-subtle">
                                        {event.payload && typeof event.payload === 'object' && (
                                            <>
                                                {(event.payload as Record<string, unknown>).entity_name && (
                                                    <span>{String((event.payload as Record<string, unknown>).entity_name)}</span>
                                                )}
                                                {(event.payload as Record<string, unknown>).full_name && (
                                                    <span>{String((event.payload as Record<string, unknown>).full_name)}</span>
                                                )}
                                                {(event.payload as Record<string, unknown>).hours && (
                                                    <span> - {String((event.payload as Record<string, unknown>).hours)}h</span>
                                                )}
                                            </>
                                        )}
                                        <span className="ml-2 text-fg-subtle">
                                            {formatters.formatDate(event.occurred_at)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Utilization Alerts */}
            {summary && (summary.avg_utilization_pct < 50 || summary.pending_approvals > 3) && (
                <div className="bg-warning/5 border border-warning/20 rounded-nb p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-warning mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-sm font-medium text-warning">Attention Required</div>
                        <div className="text-xs text-fg-muted mt-1">
                            {summary.avg_utilization_pct < 50 && (
                                <span>Average utilization is below 50%. Consider reviewing resource allocations. </span>
                            )}
                            {summary.pending_approvals > 3 && (
                                <span>{summary.pending_approvals} time entries awaiting approval.</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardPage;
