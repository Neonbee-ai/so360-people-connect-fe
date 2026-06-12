import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, Send, DollarSign, ExternalLink, Info } from 'lucide-react';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Toast, { ToastType } from '../components/Toast';
import { peopleApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import type { TimesheetEntry, TimesheetUtilizationPerson } from '../services/timesheetApi';
import type { Person } from '../types/people';

// Current week (Monday → Sunday) — default filter range.
const getCurrentWeek = (): { from: string; to: string } => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now);
    start.setDate(diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
    };
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
    });

    const defaultWeek = getCurrentWeek();
    const [people, setPeople] = useState<Person[]>([]);
    const [entries, setEntries] = useState<TimesheetEntry[]>([]);
    const [utilization, setUtilization] = useState<TimesheetUtilizationPerson[]>([]);
    const [loading, setLoading] = useState(true);
    const [personFilter, setPersonFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [fromDate, setFromDate] = useState<string>(defaultWeek.from);
    const [toDate, setToDate] = useState<string>(defaultWeek.to);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Person selector options (same people list used across PC pages)
    useEffect(() => {
        peopleApi.getAll({ status: 'active', limit: 100 })
            .then(result => setPeople(result.data))
            .catch(console.error);
    }, []);

    const loadData = useCallback(async () => {
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
            setToast({ message: 'Failed to load employee timesheets', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [personFilter, statusFilter, fromDate, toDate]);

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

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Employee Timesheets"
                subtitle="Read-only view of time logged in the Timesheets module"
                actions={
                    <button
                        onClick={() => navigate('/timesheet/my-timesheet')}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <ExternalLink size={14} />
                        Log time in Timesheets
                    </button>
                }
            />

            {/* Read-only notice */}
            <div className="flex items-start gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400">
                <Info size={14} className="text-teal-400 mt-0.5 flex-shrink-0" />
                <span>
                    Time entries are created, submitted, and approved in the Timesheets module.
                    This page is a consolidated read-only view for people managers.
                </span>
            </div>

            {/* Summary (selected range) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Hours" value={`${totals.total.toFixed(1)}h`} icon={Clock} color="teal" />
                <StatCard label="Approved Hours" value={`${totals.approved.toFixed(1)}h`} icon={CheckCircle} color="emerald" />
                <StatCard label="Submitted Hours" value={`${totals.submitted.toFixed(1)}h`} icon={Send} color="blue" />
                <StatCard label="Billable Hours" value={`${totals.billable.toFixed(1)}h`} icon={DollarSign} color="purple" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    aria-label="Person filter"
                    value={personFilter}
                    onChange={(e) => setPersonFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                >
                    <option value="">All People</option>
                    {people.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                </select>
                <select
                    aria-label="Status filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
                <input
                    type="date"
                    aria-label="From date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                />
                <span className="text-xs text-slate-500">to</span>
                <input
                    type="date"
                    aria-label="To date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                />
                {totals.cost > 0 && (
                    <div className="ml-auto flex items-center gap-1 text-xs text-slate-400">
                        <DollarSign size={12} />
                        Approved cost: {formatCurrency(totals.cost)}
                    </div>
                )}
            </div>

            {/* Entries Table */}
            {loading ? (
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : entries.length === 0 ? (
                <EmptyState
                    icon={Clock}
                    title="No timesheet entries"
                    description="No time has been logged in the Timesheets module for the selected filters."
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[100px_1fr_1fr_80px_80px_110px_100px] gap-4 px-5 py-3 bg-slate-800/50 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        <div>Date</div>
                        <div>Description</div>
                        <div>Entity / Project</div>
                        <div className="text-right">Hours</div>
                        <div className="text-center">Billable</div>
                        <div className="text-center">Status</div>
                        <div className="text-right">Cost</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-800">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="grid grid-cols-[100px_1fr_1fr_80px_80px_110px_100px] gap-4 px-5 py-3 items-center hover:bg-slate-800/30 transition-colors"
                            >
                                <div className="text-sm text-slate-300">{entry.entry_date}</div>
                                <div className="text-sm text-slate-400 truncate">{entry.description || '-'}</div>
                                <div className="min-w-0">
                                    <div className="text-sm text-slate-50 truncate">{entry.entity_name || '-'}</div>
                                    {entry.entity_type && (
                                        <div className="text-xs text-slate-600 truncate">{entry.entity_type}</div>
                                    )}
                                </div>
                                <div className="text-right text-sm font-medium text-slate-50">{entry.hours}h</div>
                                <div className="text-center text-xs">
                                    {entry.is_billable ? (
                                        <span className="text-emerald-400">Billable</span>
                                    ) : (
                                        <span className="text-slate-500">-</span>
                                    )}
                                </div>
                                <div className="text-center">
                                    <StatusBadge status={entry.status} />
                                </div>
                                <div className="text-right text-sm text-slate-300">
                                    {formatCurrency(entry.calculated_cost || 0)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default EmployeeTimesheetsPage;
