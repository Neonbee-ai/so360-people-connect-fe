import React, { useEffect, useState, useCallback } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown, AlertTriangle,
    Calendar, DollarSign, Clock, Target, Users,
    ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { toast } from '@so360/design-system';
import { utilizationApi } from '../services/peopleService';
import type { UtilizationData, UtilizationSummary } from '../types/people';

const UtilizationPage: React.FC = () => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
    });
    const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([]);
    const [summary, setSummary] = useState<UtilizationSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [sortBy, setSortBy] = useState<'name' | 'utilization' | 'cost'>('utilization');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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
            toast.error('Failed to load utilization data');
        } finally {
            setLoading(false);
        }
    }, [weekOffset]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Null-safe accessors — a single incomplete/malformed record (missing
    // `.utilization` or `.person`, e.g. no allocation/timesheet data for that
    // employee) must never crash the whole page.
    const safeName = (d?: UtilizationData | null) => d?.person?.full_name || '';
    const safePct = (d?: UtilizationData | null) => d?.utilization?.utilization_pct ?? 0;
    const safeCost = (d?: UtilizationData | null) => d?.utilization?.actual_cost ?? 0;

    // Sort data — filter out any null/undefined entries first, then sort
    // using the null-safe accessors above so a bad record sorts as 0 instead
    // of throwing.
    const sortedData = [...utilizationData]
        .filter((d): d is UtilizationData => Boolean(d))
        .sort((a, b) => {
            let cmp = 0;
            switch (sortBy) {
                case 'name':
                    cmp = safeName(a).localeCompare(safeName(b));
                    break;
                case 'utilization':
                    cmp = safePct(a) - safePct(b);
                    break;
                case 'cost':
                    cmp = safeCost(a) - safeCost(b);
                    break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

    // Derived signals
    const idlePeople = utilizationData.filter(d => d?.utilization?.is_idle);
    const overallocated = utilizationData.filter(d => d?.utilization?.is_overallocated);
    const healthyCount = utilizationData.filter(d =>
        d?.utilization && !d.utilization.is_idle && !d.utilization.is_overallocated && safePct(d) >= 30
    ).length;

    const formatCurrency = (amount: number) => formatters.formatCurrency(amount);

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
        const pct = safePct(data);
        if (data?.utilization?.is_overallocated) return 'Overallocated';
        if (data?.utilization?.is_idle) return 'Idle';
        if (pct >= 80) return 'High';
        if (pct >= 50) return 'Normal';
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
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-slate-50 transition-colors"
                        >
                            {viewMode === 'cards' ? 'Table View' : 'Card View'}
                        </button>
                        <button
                            onClick={loadData}
                            className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-slate-50 transition-colors"
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
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-800 transition-colors"
                >
                    <ChevronLeft size={18} />
                </button>
                <div className="text-center">
                    <div className="text-sm font-medium text-slate-50 flex items-center gap-2">
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
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-800 transition-colors disabled:opacity-30"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`bg-slate-900 border rounded-xl p-4 ${idlePeople.length > 0 ? 'border-rose-500/30' : 'border-slate-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">Idle Resources</span>
                        <TrendingDown size={14} className="text-rose-400" />
                    </div>
                    <div className={`text-2xl font-bold ${idlePeople.length > 0 ? 'text-rose-400' : 'text-slate-50'}`}>
                        {idlePeople.length}
                    </div>
                    {idlePeople.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {idlePeople.map(d => d?.person?.full_name || 'Unknown').join(', ')}
                        </div>
                    )}
                </div>
                <div className={`bg-slate-900 border rounded-xl p-4 ${overallocated.length > 0 ? 'border-amber-500/30' : 'border-slate-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">Overallocated</span>
                        <TrendingUp size={14} className="text-amber-400" />
                    </div>
                    <div className={`text-2xl font-bold ${overallocated.length > 0 ? 'text-amber-400' : 'text-slate-50'}`}>
                        {overallocated.length}
                    </div>
                    {overallocated.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {overallocated.map(d => d?.person?.full_name || 'Unknown').join(', ')}
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
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 mr-1">Sort by:</span>
                {(['utilization', 'name', 'cost'] as const).map(key => (
                    <button
                        key={key}
                        onClick={() => {
                            if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                            else { setSortBy(key); setSortDir('desc'); }
                        }}
                        // Border on both states keeps the buttons the same size,
                        // so selecting one does not nudge the others sideways.
                        className={`min-w-[92px] px-2.5 py-1 rounded text-xs text-center transition-colors border ${
                            sortBy === key
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                                : 'text-slate-400 border-transparent hover:text-slate-50 hover:border-slate-700'
                        }`}
                    >
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                        {sortBy === key && (sortDir === 'asc' ? ' ^' : ' v')}
                    </button>
                ))}
            </div>

            {/* Utilization Data */}
            {sortedData.length === 0 ? (
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
                // p-5 matches the resource cards above so this panel shares
                // their content width and left edge.
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="text-rose-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-rose-300">Idle Cost Signal</div>
                            <div className="text-xs text-slate-400 mt-1">
                                {idlePeople.length} resource{idlePeople.length > 1 ? 's are' : ' is'} below 30% utilization.
                                Estimated idle cost: {formatCurrency(
                                    idlePeople.reduce((sum, d) => {
                                        const idleHours = (d?.utilization?.available_hours ?? 0) - (d?.utilization?.actual_hours ?? 0);
                                        return sum + (idleHours * (d?.person?.cost_rate || 0));
                                    }, 0)
                                )} this period.
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {idlePeople.map((d, idx) => (
                                    <span key={d?.person?.id || idx} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300">
                                        {d?.person?.full_name || 'Unknown'} ({safePct(d)}%)
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
                            <div className="text-sm font-medium text-slate-50">Burn Rate Signal</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                Based on approved time entries for the current period
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold text-slate-50">{formatCurrency(summary.burn_rate_daily)}/day</div>
                            <div className="text-xs text-slate-500">{formatCurrency(summary.burn_rate_daily * 5)}/week</div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

// =============================================================================
// Utilization Card Component
// =============================================================================

const UtilizationCard: React.FC<{ data: UtilizationData }> = ({ data }) => {
    const { settings: cardSettings } = useBusinessSettings();
    const cardFormatters = useFormatters({
        currency: cardSettings?.base_currency || 'USD',
        locale: cardSettings?.document_language || 'en-US',
    });
    // Guard against an incomplete record (e.g. a person with no allocation
    // or timesheet data yet) missing `person`/`utilization` entirely.
    const rawPerson = data?.person ?? ({} as UtilizationData['person']);
    const person = { ...rawPerson, full_name: rawPerson?.full_name || 'Unknown' };
    const utilization = data?.utilization ?? ({} as UtilizationData['utilization']);
    const utilizationPct = utilization.utilization_pct ?? 0;
    const allocationPct = utilization.allocation_pct ?? 0;

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
                    {/* Name + role share the elastic space and truncate; the status
                        badges keep a fixed slot on the right so a long name never
                        shifts them between cards. */}
                    <div className="flex items-center gap-2 mb-1 h-6">
                        <span className="text-sm font-medium text-slate-50 truncate max-w-[45%]">{person.full_name}</span>
                        {person.job_title && <span className="text-xs text-slate-500 truncate min-w-0">{person.job_title}</span>}
                        <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                            {utilization.is_idle && (
                                <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded text-xs">Idle</span>
                            )}
                            {utilization.is_overallocated && (
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-xs">Over</span>
                            )}
                        </span>
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
                            <span className={`text-xs font-medium w-10 text-right tabular-nums ${getTextColor(utilizationPct)}`}>
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
                            <span className={`text-xs font-medium w-10 text-right tabular-nums ${allocationPct > 100 ? 'text-amber-400' : 'text-slate-400'}`}>
                                {allocationPct}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Metrics — fixed column widths so Available / Actual / Cost sit
                    on the same vertical lines in every card regardless of value length. */}
                <div className="flex-shrink-0 grid grid-cols-3 gap-4 w-[264px]">
                    <div className="text-right">
                        <div className="text-xs text-slate-500">Available</div>
                        <div className="text-sm font-medium text-slate-50 tabular-nums">{utilization.available_hours}h</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-500">Actual</div>
                        <div className="text-sm font-medium text-slate-50 tabular-nums">{utilization.actual_hours}h</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-500">Cost</div>
                        <div className="text-sm font-medium text-slate-50 tabular-nums truncate">
                            {cardFormatters.formatCurrency(Math.round(utilization.actual_cost || 0))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Variance indicator — always rendered so every card keeps the same
                footer baseline; a zero variance simply reads as 0h. */}
            <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center gap-2 text-xs">
                <span className="text-slate-500">Variance:</span>
                <span className={
                    utilization.variance_hours > 0 ? 'text-emerald-400' :
                    utilization.variance_hours < 0 ? 'text-amber-400' : 'text-slate-400'
                }>
                    {utilization.variance_hours > 0 ? '+' : ''}{utilization.variance_hours ?? 0}h vs planned
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-500">
                    Rate: {cardFormatters.formatCurrency(person.cost_rate || 0)}/{person.available_hours_per_day ? 'hour' : 'day'}
                </span>
            </div>
        </div>
    );
};

// =============================================================================
// Utilization Table Component
// =============================================================================

const UtilizationTable: React.FC<{ data: UtilizationData[] }> = ({ data }) => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
    });
    const formatCurrency = (amount: number) => formatters.formatCurrency(amount);

    // Normalize each row up-front so a single incomplete/malformed record
    // (missing `person` or `utilization`) never crashes this component.
    const rows = data.filter(Boolean).map((item, idx) => ({
        key: item?.person?.id || `row-${idx}`,
        fullName: item?.person?.full_name || 'Unknown',
        jobTitle: item?.person?.job_title || '',
        isIdle: !!item?.utilization?.is_idle,
        isOverallocated: !!item?.utilization?.is_overallocated,
        availableHours: item?.utilization?.available_hours ?? 0,
        plannedHours: item?.utilization?.planned_hours ?? 0,
        actualHours: item?.utilization?.actual_hours ?? 0,
        utilizationPct: item?.utilization?.utilization_pct ?? 0,
        allocationPct: item?.utilization?.allocation_pct ?? 0,
        varianceHours: item?.utilization?.variance_hours ?? 0,
        actualCost: item?.utilization?.actual_cost ?? 0,
    }));

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
                {rows.map((row) => (
                    <div
                        key={row.key}
                        className={`grid grid-cols-[1fr_80px_80px_80px_80px_80px_80px_80px] gap-2 px-5 py-3 items-center hover:bg-slate-800/30 ${
                            row.isIdle ? 'bg-rose-500/3' :
                            row.isOverallocated ? 'bg-amber-500/3' : ''
                        }`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-medium text-teal-400">
                                    {row.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm text-slate-50 truncate">{row.fullName}</div>
                                <div className="text-xs text-slate-500 truncate">{row.jobTitle}</div>
                            </div>
                        </div>
                        <div className="text-right text-sm text-slate-300">{row.availableHours}h</div>
                        <div className="text-right text-sm text-slate-300">{row.plannedHours}h</div>
                        <div className="text-right text-sm text-slate-50 font-medium">{row.actualHours}h</div>
                        <div className={`text-right text-sm font-bold ${
                            row.utilizationPct >= 70 ? 'text-emerald-400' :
                            row.utilizationPct >= 50 ? 'text-teal-400' :
                            row.utilizationPct >= 30 ? 'text-blue-400' : 'text-rose-400'
                        }`}>
                            {row.utilizationPct}%
                        </div>
                        <div className={`text-right text-sm ${row.allocationPct > 100 ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                            {row.allocationPct}%
                        </div>
                        <div className={`text-right text-sm ${
                            row.varianceHours > 0 ? 'text-emerald-400' :
                            row.varianceHours < -5 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                            {row.varianceHours > 0 ? '+' : ''}{row.varianceHours}h
                        </div>
                        <div className="text-right text-sm text-slate-300">{formatCurrency(row.actualCost)}</div>
                    </div>
                ))}
            </div>

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px_80px_80px] gap-2 px-5 py-3 bg-slate-800/50 border-t border-slate-700">
                <div className="text-xs font-medium text-slate-400">TOTALS ({rows.length} people)</div>
                <div className="text-right text-xs font-medium text-slate-300">
                    {rows.reduce((sum, r) => sum + r.availableHours, 0)}h
                </div>
                <div className="text-right text-xs font-medium text-slate-300">
                    {rows.reduce((sum, r) => sum + r.plannedHours, 0)}h
                </div>
                <div className="text-right text-xs font-medium text-slate-50">
                    {rows.reduce((sum, r) => sum + r.actualHours, 0)}h
                </div>
                <div className="text-right text-xs font-medium text-teal-400">
                    {rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.utilizationPct, 0) / rows.length) : 0}%
                </div>
                <div className="text-right text-xs font-medium text-slate-400">
                    {rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.allocationPct, 0) / rows.length) : 0}%
                </div>
                <div className="text-right text-xs font-medium text-slate-400">
                    {rows.reduce((sum, r) => sum + r.varianceHours, 0)}h
                </div>
                <div className="text-right text-xs font-medium text-slate-50">
                    {formatCurrency(rows.reduce((sum, r) => sum + r.actualCost, 0))}
                </div>
            </div>
        </div>
    );
};

export default UtilizationPage;
