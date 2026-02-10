import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, Target, TrendingUp,
    DollarSign, AlertTriangle, ArrowRight,
    UserPlus, CalendarClock, Activity,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { utilizationApi, timeEntriesApi, eventsApi } from '../services/peopleService';
import type { UtilizationSummary, TimeEntry, PeopleEvent } from '../types/people';

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [summary, setSummary] = useState<UtilizationSummary | null>(null);
    const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
    const [recentEvents, setRecentEvents] = useState<PeopleEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [summaryData, entriesData, eventsData] = await Promise.all([
                    utilizationApi.getSummary(),
                    timeEntriesApi.getAll({ limit: 5 }),
                    eventsApi.getAll({ limit: 8 }),
                ]);
                setSummary(summaryData);
                setRecentEntries(entriesData.data);
                setRecentEvents(eventsData.data);
            } catch (error) {
                console.error('Dashboard load error:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 w-48 bg-slate-800 rounded" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-800 rounded-xl" />)}
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="People Connect"
                subtitle="Resource control, allocation, and utilization intelligence"
                actions={
                    <button
                        onClick={() => navigate('/people')}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <UserPlus size={16} />
                        Add Person
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <StatCard
                    label="Weekly Burn Rate"
                    value={formatCurrency(summary?.total_cost_this_week || 0)}
                    icon={DollarSign}
                    color="purple"
                />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Active Allocations</span>
                        <Target size={16} className="text-blue-400" />
                    </div>
                    <div className="text-xl font-bold text-white">{summary?.active_allocations || 0}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Pending Approvals</span>
                        <CalendarClock size={16} className="text-amber-400" />
                    </div>
                    <div className="text-xl font-bold text-white">{summary?.pending_approvals || 0}</div>
                    {summary && summary.pending_approvals > 0 && (
                        <button
                            onClick={() => navigate('/time')}
                            className="text-xs text-amber-400 hover:text-amber-300 mt-1 flex items-center gap-1"
                        >
                            Review now <ArrowRight size={12} />
                        </button>
                    )}
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Daily Burn Rate</span>
                        <TrendingUp size={16} className="text-rose-400" />
                    </div>
                    <div className="text-xl font-bold text-white">{formatCurrency(summary?.burn_rate_daily || 0)}</div>
                </div>
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Time Entries */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Recent Time Entries</h3>
                        <button
                            onClick={() => navigate('/time')}
                            className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
                        >
                            View all <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-800">
                        {recentEntries.length === 0 ? (
                            <div className="p-6 text-center text-sm text-slate-500">No time entries yet</div>
                        ) : (
                            recentEntries.map((entry) => (
                                <div key={entry.id} className="px-5 py-3 flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white truncate">{entry.person?.full_name || 'Unknown'}</div>
                                        <div className="text-xs text-slate-500 truncate">
                                            {entry.entity_name || entry.entity_type} - {entry.description || 'No description'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 ml-3">
                                        <span className="text-sm font-medium text-slate-300">{entry.hours}h</span>
                                        <StatusBadge status={entry.status} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Activity Feed</h3>
                        <Activity size={16} className="text-slate-500" />
                    </div>
                    <div className="divide-y divide-slate-800">
                        {recentEvents.length === 0 ? (
                            <div className="p-6 text-center text-sm text-slate-500">No events yet</div>
                        ) : (
                            recentEvents.map((event) => (
                                <div key={event.id} className="px-5 py-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-teal-400">
                                            {eventTypeLabels[event.event_type] || event.event_type}
                                        </span>
                                        <span className="text-xs text-slate-600">by</span>
                                        <span className="text-xs text-slate-400">{event.actor_name || 'System'}</span>
                                    </div>
                                    <div className="text-xs text-slate-500">
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
                                        <span className="ml-2 text-slate-600">
                                            {new Date(event.occurred_at).toLocaleDateString()}
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
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-sm font-medium text-amber-300">Attention Required</div>
                        <div className="text-xs text-slate-400 mt-1">
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
