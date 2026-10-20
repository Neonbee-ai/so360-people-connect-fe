import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, Send, DollarSign, ExternalLink } from 'lucide-react';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { toast, Select, Button, Banner, KpiCard, ListPageTemplate, DataTable, DateInput, Stack, Cluster } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { peopleApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import type { TimesheetEntry, TimesheetUtilizationPerson } from '../services/timesheetApi';
import type { Person } from '../types/people';

/**
 * Current week (Monday → Sunday) as date-only business values, derived from the
 * org's business date (`YYYY-MM-DD`).
 *
 * Two defects fixed here. The old version started from `new Date()` and read
 * `getDay()`/`getDate()` in LOCAL time while emitting the UTC day, so the
 * window could be both the wrong week AND off by a day. It was also a
 * module-level function reaching for a component-scoped `formatters`, which is
 * simply not in scope.
 *
 * Taking the resolved business date makes this a pure function and keeps the
 * arithmetic in one clock: 'YYYY-MM-DD' parses as UTC midnight, so the UTC
 * accessors are the consistent choice and the result is stable in every zone.
 */
const getCurrentWeek = (businessToday: string): { from: string; to: string } => {
    const start = new Date(`${businessToday}T00:00:00Z`);
    const day = start.getUTCDay();
    // Sunday (0) belongs to the week that STARTED six days earlier.
    start.setUTCDate(start.getUTCDate() - day + (day === 0 ? -6 : 1));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
};

/**
 * READ-ONLY view of timesheet data owned by the Timesheets module.
 * People Connect no longer creates, edits, submits, or approves time —
 * all time logging lives in Timesheets; this page only consumes it.
 */
const EmployeeTimesheetsPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });

    const defaultWeek = getCurrentWeek(formatters.businessToday());
    const [people, setPeople] = useState<Person[]>([]);
    const [entries, setEntries] = useState<TimesheetEntry[]>([]);
    const [utilization, setUtilization] = useState<TimesheetUtilizationPerson[]>([]);
    const [loading, setLoading] = useState(true);
    const [personFilter, setPersonFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [fromDate, setFromDate] = useState<string>(defaultWeek.from);
    const [toDate, setToDate] = useState<string>(defaultWeek.to);

    // Person selector options (same people list used across PC pages)
    useEffect(() => {
        peopleApi.getAll({ status: 'active', limit: 100 })
            .then(result => setPeople(result.data))
            .catch(console.error);
    }, []);

    // An end date before the start date is not a filter that can ever match —
    // block the fetch and say so, instead of rendering a misleading "no entries".
    const dateRangeError =
        fromDate && toDate && toDate < fromDate
            ? 'End Date cannot be earlier than Start Date.'
            : '';

    const loadData = useCallback(async () => {
        if (dateRangeError) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const [entriesResult, utilizationResult] = await Promise.all([
                timesheetApi.getEntries({
                    person_id: personFilter || undefined,
                    status: statusFilter || undefined,
                    from_date: fromDate || undefined,
                    to_date: toDate || undefined,
                    limit: 100,
                }),
                timesheetApi.getUtilization({
                    from_date: fromDate || undefined,
                    to_date: toDate || undefined,
                    person_ids: personFilter || undefined,
                }),
            ]);
            setEntries(entriesResult.data || []);
            setUtilization(utilizationResult.people || []);
        } catch (error) {
            console.error('Failed to load employee timesheets:', error);
            toast.error('Failed to load employee timesheets');
        } finally {
            setLoading(false);
        }
    }, [personFilter, statusFilter, fromDate, toDate, dateRangeError]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Summary across the selected range (from the utilization endpoint)
    const totals = utilization.reduce(
        (acc, p) => ({
            total: acc.total + (p.total_hours || 0),
            approved: acc.approved + (p.approved_hours || 0),
            submitted: acc.submitted + (p.submitted_hours || 0),
            billable: acc.billable + (p.billable_hours || 0),
            cost: acc.cost + (p.approved_cost || 0),
        }),
        { total: 0, approved: 0, submitted: 0, billable: 0, cost: 0 },
    );

    const formatCurrency = (amount: number) => formatters.formatCurrency(amount);

    const columns: DataTableColumn<TimesheetEntry>[] = [
        { key: 'entry_date', header: 'Date', render: (entry) => <span className="text-nb-sm text-fg">{entry.entry_date}</span> },
        { key: 'description', header: 'Description', render: (entry) => <span className="text-nb-sm text-fg-muted truncate">{entry.description || '-'}</span> },
        {
            key: 'entity',
            header: 'Entity / Project',
            render: (entry) => (
                <div className="min-w-0">
                    <div className="text-nb-sm text-fg truncate">{entry.entity_name || '-'}</div>
                    {entry.entity_type && <div className="text-nb-xs text-fg-subtle truncate">{entry.entity_type}</div>}
                </div>
            ),
        },
        { key: 'hours', header: 'Hours', align: 'right', render: (entry) => <span className="text-nb-sm font-medium text-fg">{entry.hours}h</span> },
        {
            key: 'is_billable',
            header: 'Billable',
            align: 'center',
            render: (entry) => entry.is_billable
                ? <span className="text-nb-xs text-success">Billable</span>
                : <span className="text-nb-xs text-fg-subtle">-</span>,
        },
        { key: 'status', header: 'Status', align: 'center', render: (entry) => <StatusBadge status={entry.status} /> },
        { key: 'cost', header: 'Cost', align: 'right', render: (entry) => <span className="text-nb-sm text-fg">{formatCurrency(entry.calculated_cost || 0)}</span> },
    ];

    return (
        <ListPageTemplate trail={[]}
            title="Employee Timesheets"
            description="Read-only view of time logged in the Timesheets module"
            primaryAction={
                <Button onClick={() => navigate('/timesheet/my-timesheet')}>
                    <ExternalLink size={14} />
                    Log time in Timesheets
                </Button>
            }
            loading={loading && !dateRangeError}
            isEmpty={!!dateRangeError || entries.length === 0}
            empty={dateRangeError ? (
                <EmptyState
                    icon={Clock}
                    title="Invalid date range"
                    description="End Date cannot be earlier than Start Date. Adjust the range to see timesheet entries."
                />
            ) : (
                <EmptyState
                    icon={Clock}
                    title="No timesheet entries"
                    description="No time has been logged in the Timesheets module for the selected filters."
                />
            )}
            kpis={(
                <Stack gap="default">
                    <Banner variant="info">
                        Time entries are created, submitted, and approved in the Timesheets module.
                        This page is a consolidated read-only view for people managers.
                    </Banner>
                    <div className="grid grid-cols-1 wc-medium:grid-cols-2 wc-expanded:grid-cols-4 gap-nb-4">
                        <KpiCard label="Total Hours" value={`${totals.total.toFixed(1)}h`} icon={Clock} />
                        <KpiCard label="Approved Hours" value={`${totals.approved.toFixed(1)}h`} icon={CheckCircle} />
                        <KpiCard label="Submitted Hours" value={`${totals.submitted.toFixed(1)}h`} icon={Send} />
                        <KpiCard label="Billable Hours" value={`${totals.billable.toFixed(1)}h`} icon={DollarSign} />
                    </div>
                </Stack>
            )}
            filters={(
                <Stack gap="tight">
                    <Cluster gap="default" align="center">
                        <Select name="employeetimesheets-select-36" aria-label="Person filter" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} options={[{ value: "", label: "All People" }, ...people.map((p) => ({ value: p.id, label: p.full_name }))]} />
                        <Select name="employeetimesheets-select-37" aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: "", label: "All Statuses" }, { value: "draft", label: "Draft" }, { value: "submitted", label: "Submitted" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }]} />
                        <DateInput
                            name="timesheets-from-date"
                            aria-label="From date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(v: string) => setFromDate(v)}
                        />
                        <span className="text-nb-xs text-fg-subtle">to</span>
                        <DateInput
                            name="timesheets-to-date"
                            aria-label="To date"
                            value={toDate}
                            min={fromDate || undefined}
                            onChange={(v: string) => setToDate(v)}
                        />
                        {totals.cost > 0 && (
                            <span className="flex items-center gap-nb-1 text-nb-xs text-fg-muted">
                                <DollarSign size={12} />
                                Approved cost: {formatCurrency(totals.cost)}
                            </span>
                        )}
                    </Cluster>
                    {dateRangeError && <Banner variant="danger">{dateRangeError}</Banner>}
                </Stack>
            )}
        >
            <DataTable name="employee-timesheets" columns={columns} rows={entries} rowKey={(entry) => entry.id} />
        </ListPageTemplate>
    );
};

export default EmployeeTimesheetsPage;
