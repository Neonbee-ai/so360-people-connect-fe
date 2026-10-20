import React, { useEffect, useState, useCallback } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown,
    Calendar, DollarSign, Clock, Target, Users,
    ChevronLeft, ChevronRight, RefreshCw, ArrowUpDown,
} from 'lucide-react';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import EmptyState from '../components/EmptyState';
import { toast, IconButton, ListPageTemplate, KpiCard, Banner, Stack, Cluster, DataTable, Grid, Select, Progress, Avatar, Badge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { utilizationApi } from '../services/peopleService';
import type { UtilizationData, UtilizationSummary } from '../types/people';

const UtilizationPage: React.FC = () => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });
    const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([]);
    const [summary, setSummary] = useState<UtilizationSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<{ start: string; end: string }>({ start: '', end: '' });
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
            start: formatters.toBusinessDate(start),
            end: formatters.toBusinessDate(end),
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

    const idleCost = idlePeople.reduce((sum, d) => {
        const idleHours = (d?.utilization?.available_hours ?? 0) - (d?.utilization?.actual_hours ?? 0);
        return sum + (idleHours * (d?.person?.cost_rate || 0));
    }, 0);

    // Normalise each row up-front so one incomplete record (missing `person`
    // or `utilization`) never crashes the table.
    const rows = sortedData.map((item, idx) => ({
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
    type Row = typeof rows[number];

    const sum = (f: (r: Row) => number) => rows.reduce((t, r) => t + f(r), 0);
    const avg = (f: (r: Row) => number) => (rows.length > 0 ? Math.round(sum(f) / rows.length) : 0);

    const utilTone = (pct: number) =>
        pct >= 90 ? 'warning' : pct >= 30 ? 'brand' : 'danger';

    const columns: DataTableColumn<Row>[] = [
        {
            key: 'person',
            header: 'Person',
            render: (row) => (
                <Cluster gap="tight" className="flex-nowrap">
                    <Avatar name={row.fullName} size="sm" />
                    <Stack gap="none">
                        <span className="truncate text-nb-sm text-fg">{row.fullName}</span>
                        {row.jobTitle && <span className="truncate text-nb-xs text-fg-subtle">{row.jobTitle}</span>}
                    </Stack>
                    {row.isIdle && <Badge tone="danger">Idle</Badge>}
                    {row.isOverallocated && <Badge tone="warning">Over</Badge>}
                </Cluster>
            ),
        },
        { key: 'capacity', header: 'Capacity', align: 'right', render: (row) => <span className="tabular-nums">{row.availableHours}h</span> },
        {
            key: 'allocated',
            header: 'Allocated',
            align: 'right',
            hideBelow: 'medium',
            render: (row) => (
                <span className={`tabular-nums ${row.allocationPct > 100 ? 'text-warning' : ''}`}>
                    {row.plannedHours}h ({row.allocationPct}%)
                </span>
            ),
        },
        { key: 'actual', header: 'Actual', align: 'right', render: (row) => <span className="tabular-nums">{row.actualHours}h</span> },
        {
            key: 'utilization',
            header: 'Utilization',
            align: 'right',
            render: (row) => (
                <Cluster gap="tight" justify="end" className="flex-nowrap">
                    <div className="w-24"><Progress value={Math.min(row.utilizationPct, 100)} size="sm" tone={utilTone(row.utilizationPct)} label={`Utilization ${row.utilizationPct}%`} /></div>
                    <span className="w-10 text-right font-medium tabular-nums">{row.utilizationPct}%</span>
                </Cluster>
            ),
        },
        {
            key: 'variance',
            header: 'Variance',
            align: 'right',
            hideBelow: 'medium',
            render: (row) => (
                <span className={`tabular-nums ${row.varianceHours > 0 ? 'text-success' : row.varianceHours < -5 ? 'text-warning' : 'text-fg-muted'}`}>
                    {row.varianceHours > 0 ? '+' : ''}{row.varianceHours}h
                </span>
            ),
        },
        { key: 'cost', header: 'Cost', align: 'right', render: (row) => <span className="tabular-nums">{formatCurrency(Math.round(row.actualCost))}</span> },
    ];

    const weekNavigator = (
        <Cluster gap="tight" align="center" className="flex-nowrap">
            <IconButton label="Previous week" variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => setWeekOffset(prev => prev - 1)} />
            <Cluster gap="tight" align="center" className="flex-nowrap">
                <Calendar size={14} className="text-primary" />
                <span className="whitespace-nowrap text-nb-sm text-fg">
                    {period.start ? `${period.start} to ${period.end}` : 'Loading...'}
                </span>
            </Cluster>
            <IconButton label="Next week" variant="ghost" icon={<ChevronRight size={16} />} onClick={() => setWeekOffset(prev => Math.min(prev + 1, 0))} disabled={weekOffset >= 0} />
        </Cluster>
    );

    const sortControl = (
        <Cluster gap="tight" align="center" className="flex-nowrap">
            <Select
                name="utilization-sort"
                aria-label="Sort by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'utilization' | 'cost')}
                options={[{ value: 'utilization', label: 'Utilization' }, { value: 'name', label: 'Name' }, { value: 'cost', label: 'Cost' }]}
            />
            <IconButton
                label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
                variant="ghost"
                icon={<ArrowUpDown size={14} />}
                onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
            />
        </Cluster>
    );

    return (
        <ListPageTemplate trail={[]}
            title="Utilization Intelligence"
            description="Planned vs Actual | Idle detection | Burn rate signals"
            primaryAction={<IconButton label="Refresh" variant="ghost" icon={<RefreshCw size={14} />} onClick={loadData} />}
            loading={loading}
            isEmpty={sortedData.length === 0}
            empty={(
                <EmptyState
                    icon={BarChart3}
                    title="No utilization data"
                    description="Utilization metrics will appear once people are allocated and time is logged."
                />
            )}
            kpis={(
                <Grid columns={4} gap="md">
                    <KpiCard label="Avg utilization" value={`${summary?.avg_utilization_pct || 0}%`} icon={Target} />
                    <KpiCard label="Weekly burn" value={formatCurrency(summary?.total_cost_this_week || 0)} icon={DollarSign} />
                    <KpiCard label="Total hours" value={summary?.total_hours_this_week || 0} icon={Clock} />
                    <KpiCard label="Active resources" value={summary?.total_people || 0} icon={Users} />
                    <KpiCard
                        label="Idle resources"
                        value={idlePeople.length}
                        icon={TrendingDown}
                        hint={idlePeople.length > 0 ? idlePeople.map(d => d?.person?.full_name || 'Unknown').join(', ') : undefined}
                    />
                    <KpiCard
                        label="Overallocated"
                        value={overallocated.length}
                        icon={TrendingUp}
                        hint={overallocated.length > 0 ? overallocated.map(d => d?.person?.full_name || 'Unknown').join(', ') : undefined}
                    />
                    <KpiCard label="Healthy" value={healthyCount} icon={BarChart3} hint="Within normal range" />
                    <KpiCard
                        label="Daily burn"
                        value={formatCurrency(summary?.burn_rate_daily || 0)}
                        icon={DollarSign}
                        hint={`${formatCurrency((summary?.burn_rate_daily || 0) * 5)}/week from approved time`}
                    />
                </Grid>
            )}
            filters={weekNavigator}
            toolbarEnd={sortControl}
        >
            <Stack gap="default">
                <DataTable name="utilization-table" rowKey={(row: Row) => row.key} rows={rows} columns={columns} />

                <p className="text-nb-xs text-fg-muted">
                    <span className="font-medium">Totals ({rows.length} people)</span>
                    {' · '}Capacity {sum(r => r.availableHours)}h · Planned {sum(r => r.plannedHours)}h · Actual {sum(r => r.actualHours)}h
                    {' · '}Utilization {avg(r => r.utilizationPct)}% · Allocation {avg(r => r.allocationPct)}% · Variance {sum(r => r.varianceHours)}h
                    {' · '}Cost {formatCurrency(sum(r => r.actualCost))}
                </p>

                {/* Idle Cost Signal */}
                {idlePeople.length > 0 && (
                    <Banner variant="danger">
                        <div className="text-nb-sm font-medium">Idle cost signal</div>
                        <div className="text-nb-xs mt-nb-1">
                            {idlePeople.length} resource{idlePeople.length > 1 ? 's are' : ' is'} below 30% utilization.
                            Estimated idle cost: {formatCurrency(idleCost)} this period.
                        </div>
                    </Banner>
                )}
            </Stack>
        </ListPageTemplate>
    );
};

export default UtilizationPage;
