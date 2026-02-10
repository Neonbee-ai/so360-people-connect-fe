import React, { useEffect, useState, useCallback } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown, AlertTriangle,
    Calendar, DollarSign, Clock, Target, Users,
    ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Toast, { ToastType } from '../components/Toast';
import { utilizationApi } from '../services/peopleService';
import type { UtilizationData, UtilizationSummary } from '../types/people';

const UtilizationPage: React.FC = () => {
    const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([]);
    const [summary, setSummary] = useState<UtilizationSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [sortBy, setSortBy] = useState<'name' | 'utilization' | 'cost'>('utilization');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Compute initial week
    const getWeekDates = (offset: number = 0) => {
        const now = new Date();
        now.setDate(now.getDate() + (offset * 7));
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(now);
        start.setDate(diff);
        const end = new Date(start);
        end.setDate(end.getDate() + 4);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
        };
    };

    const [weekOffset, setWeekOffset] = useState(0);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const dates = getWeekDates(weekOffset);

            const [utilData, summaryData] = await Promise.all([
                utilizationApi.getAll({ period_start: dates.start, period_end: dates.end }),
                utilizationApi.getSummary(),
            ]);

            setUtilizationData(utilData.data);
            setPeriod(utilData.period || dates);
            setSummary(summaryData);
        } catch (error) {
            console.error('Failed to load utilization:', error);
            setToast({ message: 'Failed to load utilization data', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [weekOffset]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Sort data
    const sortedData = [...utilizationData].sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
            case 'name':
                cmp = a.person.full_name.localeCompare(b.person.full_name);
                break;
            case 'utilization':
                cmp = (a.utilization.utilization_pct || 0) - (b.utilization.utilization_pct || 0);
                break;
            case 'cost':
                cmp = (a.utilization.actual_cost || 0) - (b.utilization.actual_cost || 0);
                break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
    });

    // Derived signals
    const idlePeople = utilizationData.filter(d => d.utilization.is_idle);
    const overallocated = utilizationData.filter(d => d.utilization.is_overallocated);
    const healthyCount = utilizationData.filter(d =>
        !d.utilization.is_idle && !d.utilization.is_overallocated && d.utilization.utilization_pct >= 30
    ).length;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
    };

    const getUtilizationColor = (pct: number) => {
        if (pct >= 90) return 'text-amber-400';
        if (pct >= 70) return 'text-emerald-400';
        if (pct >= 50) return 'text-teal-400';
        if (pct >= 30) return 'text-blue-400';
        return 'text-rose-400';
    };

    const getUtilizationBarColor = (pct: number) => {
        if (pct >= 90) return 'bg-amber-500';
        if (pct >= 70) return 'bg-emerald-500';
        if (pct >= 50) return 'bg-teal-500';
        if (pct >= 30) return 'bg-blue-500';
        return 'bg-rose-500';
    };

    const getUtilizationLabel = (data: UtilizationData) => {
        if (data.utilization.is_overallocated) return 'Overallocated';
        if (data.utilization.is_idle) return 'Idle';
        if (data.utilization.utilization_pct >= 80) return 'High';
        if (data.utilization.utilization_pct >= 50) return 'Normal';
        return 'Low';
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 w-48 bg-slate-800 rounded" />
                    <div className="grid grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-800 rounded-xl" />)}
                    </div>
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-800 rounded-xl" />)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Utilization Intelligence"
                subtitle="Planned vs Actual | Idle detection | Burn rate signals"
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
                        >
                            {viewMode === 'cards' ? 'Table View' : 'Card View'}
                        </button>
                        <button
                            onClick={loadData}
                            className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                }
            />

            {/* Period Navigator */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-5 py-3">
                <button
                    onClick={() => setWeekOffset(prev => prev - 1)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                    <ChevronLeft size={18} />
                </button>
                <div className="text-center">
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                        <Calendar size={14} className="text-teal-400" />
                        Week of {period.start || 'Loading...'}
                    </div>
                    <div className="text-xs text-slate-500">
                        {period.start} to {period.end}
                    </div>
                </div>
                <button
                    onClick={() => setWeekOffset(prev => Math.min(prev + 1, 0))}
                    disabled={weekOffset >= 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Avg Utilization"
                    value={`${summary?.avg_utilization_pct || 0}%`}
                    icon={Target}
                    color={(summary?.avg_utilization_pct || 0) >= 60 ? 'emerald' : 'amber'}
                />
                <StatCard
                    label="Weekly Burn"
                    value={formatCurrency(summary?.total_cost_this_week || 0)}
                    icon={DollarSign}
                    color="purple"
                />
                <StatCard
                    label="Total Hours"
                    value={summary?.total_hours_this_week || 0}
                    icon={Clock}
                    color="blue"
                />
                <StatCard
                    label="Active Resources"
                    value={summary?.total_people || 0}
                    icon={Users}
                    color="teal"
                />
            </div>

            {/* Signals Row */}
            <div className="grid grid-cols-3 gap-4">
                <div className={`bg-slate-900 border rounded-xl p-4 ${idlePeople.length > 0 ? 'border-rose-500/30' : 'border-slate-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">Idle Resources</span>
                        <TrendingDown size={14} className="text-rose-400" />
                    </div>
                    <div className={`text-2xl font-bold ${idlePeople.length > 0 ? 'text-rose-400' : 'text-white'}`}>
                        {idlePeople.length}
                    </div>
                    {idlePeople.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1">
                            {idlePeople.map(d => d.person.full_name).join(', ')}
                        </div>
                    )}
                </div>
                <div className={`bg-slate-900 border rounded-xl p-4 ${overallocated.length > 0 ? 'border-amber-500/30' : 'border-slate-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">Overallocated</span>
                        <TrendingUp size={14} className="text-amber-400" />
                    </div>
                    <div className={`text-2xl font-bold ${overallocated.length > 0 ? 'text-amber-400' : 'text-white'}`}>
                        {overallocated.length}
                    </div>
                    {overallocated.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1">
                            {overallocated.map(d => d.person.full_name).join(', ')}
                        </div>
                    )}
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">Healthy</span>
                        <BarChart3 size={14} className="text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">{healthyCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Within normal range</div>
                </div>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">Sort by:</span>
                {(['utilization', 'name', 'cost'] as const).map(key => (
                    <button
                        key={key}
                        onClick={() => {
                            if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                            else { setSortBy(key); setSortDir('desc'); }
                        }}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                            sortBy === key
                                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                        {sortBy === key && (sortDir === 'asc' ? ' ^' : ' v')}
                    </button>
                ))}
            </div>

            {/* Utilization Data */}
            {utilizationData.length === 0 ? (
                <EmptyState
                    icon={BarChart3}
                    title="No utilization data"
                    description="Utilization metrics will appear once people are allocated and time is logged."
                />
            ) : viewMode === 'cards' ? (
                <div className="space-y-3">
                    {sortedData.map((item) => (
                        <UtilizationCard key={item.person.id} data={item} />
                    ))}
                </div>
            ) : (
                <UtilizationTable data={sortedData} />
            )}

            {/* Idle Cost Signal */}
            {idlePeople.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="text-rose-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <div className="text-sm font-medium text-rose-300">Idle Cost Signal</div>
                            <div className="text-xs text-slate-400 mt-1">
                                {idlePeople.length} resource{idlePeople.length > 1 ? 's are' : ' is'} below 30% utilization.
                                Estimated idle cost: {formatCurrency(
                                    idlePeople.reduce((sum, d) => {
                                        const idleHours = d.utilization.available_hours - d.utilization.actual_hours;
                                        return sum + (idleHours * (d.person.cost_rate || 0));
                                    }, 0)
                                )} this period.
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {idlePeople.map(d => (
                                    <span key={d.person.id} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300">
                                        {d.person.full_name} ({d.utilization.utilization_pct}%)
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Burn Rate Signal */}
            {summary && summary.burn_rate_daily > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-white">Burn Rate Signal</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                Based on approved time entries for the current period
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold text-white">{formatCurrency(summary.burn_rate_daily)}/day</div>
                            <div className="text-xs text-slate-500">{formatCurrency(summary.burn_rate_daily * 5)}/week</div>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// =============================================================================
// Utilization Card Component
// =============================================================================

const UtilizationCard: React.FC<{ data: UtilizationData }> = ({ data }) => {
    const { person, utilization } = data;
    const utilizationPct = utilization.utilization_pct || 0;
    const allocationPct = utilization.allocation_pct || 0;

    const getBarColor = (pct: number) => {
        if (pct >= 90) return 'bg-amber-500';
        if (pct >= 70) return 'bg-emerald-500';
        if (pct >= 50) return 'bg-teal-500';
        if (pct >= 30) return 'bg-blue-500';
        return 'bg-rose-500';
    };

    const getTextColor = (pct: number) => {
        if (pct >= 90) return 'text-amber-400';
        if (pct >= 70) return 'text-emerald-400';
        if (pct >= 50) return 'text-teal-400';
        if (pct >= 30) return 'text-blue-400';
        return 'text-rose-400';
    };

    return (
        <div className={`bg-slate-900 border rounded-xl p-5 transition-all ${
            utilization.is_idle ? 'border-rose-500/30' :
            utilization.is_overallocated ? 'border-amber-500/30' :
            'border-slate-800 hover:border-slate-700'
        }`}>
            <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-teal-400">
                        {person.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white truncate">{person.full_name}</span>
                        {person.job_title && <span className="text-xs text-slate-500">{person.job_title}</span>}
                        {utilization.is_idle && (
                            <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded text-xs">Idle</span>
                        )}
                        {utilization.is_overallocated && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-xs">Over</span>
                        )}
                    </div>

                    {/* Utilization Bar */}
                    <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-16">Actual</span>
                            <div className="flex-1 bg-slate-800 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${getBarColor(utilizationPct)}`}
                                    style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                                />
                            </div>
                            <span className={`text-xs font-medium w-10 text-right ${getTextColor(utilizationPct)}`}>
                                {utilizationPct}%
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-16">Planned</span>
                            <div className="flex-1 bg-slate-800 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${allocationPct > 100 ? 'bg-amber-500' : 'bg-slate-600'}`}
                                    style={{ width: `${Math.min(allocationPct, 100)}%` }}
                                />
                            </div>
                            <span className={`text-xs font-medium w-10 text-right ${allocationPct > 100 ? 'text-amber-400' : 'text-slate-400'}`}>
                                {allocationPct}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Metrics */}
                <div className="flex-shrink-0 grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-xs text-slate-500">Available</div>
                        <div className="text-sm font-medium text-white">{utilization.available_hours}h</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Actual</div>
                        <div className="text-sm font-medium text-white">{utilization.actual_hours}h</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Cost</div>
                        <div className="text-sm font-medium text-white">
                            ${Math.round(utilization.actual_cost || 0)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Variance indicator */}
            {utilization.variance_hours !== 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Variance:</span>
                    <span className={utilization.variance_hours > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        {utilization.variance_hours > 0 ? '+' : ''}{utilization.variance_hours}h vs planned
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-500">
                        Rate: ${person.cost_rate}/{person.available_hours_per_day ? 'hour' : 'day'}
                    </span>
                </div>
            )}
        </div>
    );
};

// =============================================================================
// Utilization Table Component
// =============================================================================

const UtilizationTable: React.FC<{ data: UtilizationData[] }> = ({ data }) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px_80px_80px] gap-2 px-5 py-3 bg-slate-800/50 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <div>Person</div>
                <div className="text-right">Available</div>
                <div className="text-right">Planned</div>
                <div className="text-right">Actual</div>
                <div className="text-right">Util %</div>
                <div className="text-right">Alloc %</div>
                <div className="text-right">Variance</div>
                <div className="text-right">Cost</div>
            </div>
            <div className="divide-y divide-slate-800">
                {data.map((item) => (
                    <div
                        key={item.person.id}
                        className={`grid grid-cols-[1fr_80px_80px_80px_80px_80px_80px_80px] gap-2 px-5 py-3 items-center hover:bg-slate-800/30 ${
                            item.utilization.is_idle ? 'bg-rose-500/3' :
                            item.utilization.is_overallocated ? 'bg-amber-500/3' : ''
                        }`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-medium text-teal-400">
                                    {item.person.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm text-white truncate">{item.person.full_name}</div>
                                <div className="text-xs text-slate-500 truncate">{item.person.job_title}</div>
                            </div>
                        </div>
                        <div className="text-right text-sm text-slate-300">{item.utilization.available_hours}h</div>
                        <div className="text-right text-sm text-slate-300">{item.utilization.planned_hours}h</div>
                        <div className="text-right text-sm text-white font-medium">{item.utilization.actual_hours}h</div>
                        <div className={`text-right text-sm font-bold ${
                            item.utilization.utilization_pct >= 70 ? 'text-emerald-400' :
                            item.utilization.utilization_pct >= 50 ? 'text-teal-400' :
                            item.utilization.utilization_pct >= 30 ? 'text-blue-400' : 'text-rose-400'
                        }`}>
                            {item.utilization.utilization_pct}%
                        </div>
                        <div className={`text-right text-sm ${item.utilization.allocation_pct > 100 ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                            {item.utilization.allocation_pct}%
                        </div>
                        <div className={`text-right text-sm ${
                            item.utilization.variance_hours > 0 ? 'text-emerald-400' :
                            item.utilization.variance_hours < -5 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                            {item.utilization.variance_hours > 0 ? '+' : ''}{item.utilization.variance_hours}h
                        </div>
                        <div className="text-right text-sm text-slate-300">{formatCurrency(item.utilization.actual_cost || 0)}</div>
                    </div>
                ))}
            </div>

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px_80px_80px] gap-2 px-5 py-3 bg-slate-800/50 border-t border-slate-700">
                <div className="text-xs font-medium text-slate-400">TOTALS ({data.length} people)</div>
                <div className="text-right text-xs font-medium text-slate-300">
                    {data.reduce((sum, d) => sum + d.utilization.available_hours, 0)}h
                </div>
                <div className="text-right text-xs font-medium text-slate-300">
                    {data.reduce((sum, d) => sum + d.utilization.planned_hours, 0)}h
                </div>
                <div className="text-right text-xs font-medium text-white">
                    {data.reduce((sum, d) => sum + d.utilization.actual_hours, 0)}h
                </div>
                <div className="text-right text-xs font-medium text-teal-400">
                    {data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.utilization.utilization_pct, 0) / data.length) : 0}%
                </div>
                <div className="text-right text-xs font-medium text-slate-400">
                    {data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.utilization.allocation_pct, 0) / data.length) : 0}%
                </div>
                <div className="text-right text-xs font-medium text-slate-400">
                    {data.reduce((sum, d) => sum + d.utilization.variance_hours, 0)}h
                </div>
                <div className="text-right text-xs font-medium text-white">
                    {formatCurrency(data.reduce((sum, d) => sum + (d.utilization.actual_cost || 0), 0))}
                </div>
            </div>
        </div>
    );
};

export default UtilizationPage;
