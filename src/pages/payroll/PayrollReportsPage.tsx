import React, { useEffect, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import { toast, Select } from '@so360/design-system';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { payrollApi, ReportResult, PayrollGroup } from '../../services/payrollApi';
import { departmentsApi } from '../../services/departmentsService';

const inputCls = 'px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary';

const REPORTS: { key: string; label: string; description: string }[] = [
    { key: 'summary', label: 'Payroll Summary', description: 'Totals per run: gross, deductions, net and employer cost.' },
    { key: 'salary-register', label: 'Salary Register', description: 'Component-wise register of every employee in a period.' },
    { key: 'department-cost', label: 'Department Cost', description: 'Payroll cost split by department.' },
    { key: 'employer-contributions', label: 'Employer Contributions', description: 'PF, ESI, gratuity and other employer-side costs.' },
    { key: 'deductions', label: 'Deductions', description: 'All employee deductions including statutory ones.' },
    { key: 'component', label: 'Component Report', description: 'A single component across employees and periods.' },
    { key: 'variance', label: 'Variance', description: 'Pay changes between consecutive runs, per employee.' },
    { key: 'history', label: 'Payroll History', description: 'Every closed run with totals over time.' },
];

const PayrollReportsPage: React.FC = () => {
    const [selectedReport, setSelectedReport] = useState<string>('');
    const [result, setResult] = useState<ReportResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [groups, setGroups] = useState<PayrollGroup[]>([]);
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
    const [filters, setFilters] = useState({ from: '', to: '', group_id: '', department_id: '' });

    useEffect(() => {
        payrollApi.groups.list().then(r => setGroups(r.data)).catch(() => {});
        departmentsApi.getAll({ limit: 200 }).then(r => setDepartments(r.data.map(d => ({ id: d.id, name: d.name })))).catch(() => {});
    }, []);

    const runReport = async (key: string) => {
        try {
            setSelectedReport(key);
            setLoading(true);
            const report = await payrollApi.reports.run(key, {
                from: filters.from || undefined,
                to: filters.to || undefined,
                group_id: filters.group_id || undefined,
                department_id: filters.department_id || undefined,
            });
            setResult(report);
        } catch {
            toast.error('Failed to run report');
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const exportCsv = async () => {
        if (!selectedReport) return;
        try {
            setExporting(true);
            await payrollApi.reports.exportCsv(selectedReport, {
                from: filters.from || undefined,
                to: filters.to || undefined,
                group_id: filters.group_id || undefined,
                department_id: filters.department_id || undefined,
            });
        } catch {
            toast.error('Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="Payroll Reports" subtitle="Registers, cost splits and statutory summaries" />

            {/* Report picker */}
            <div className="grid grid-cols-4 gap-3">
                {REPORTS.map(report => (
                    <button
                        key={report.key}
                        onClick={() => runReport(report.key)}
                        className={`text-left p-4 rounded-xl border transition-colors ${
                            selectedReport === report.key
                                ? 'bg-primary/10 border-primary/40'
                                : 'bg-surface border-line hover:border-line-strong'
                        }`}
                    >
                        <FileSpreadsheet size={16} className={selectedReport === report.key ? 'text-primary' : 'text-fg-subtle'} />
                        <div className="text-sm font-medium text-fg mt-2">{report.label}</div>
                        <div className="text-xs text-fg-muted mt-1">{report.description}</div>
                    </button>
                ))}
            </div>

            {/* Filter bar */}
            <div className="flex items-end gap-3">
                <div>
                    <label className="block text-xs text-fg-muted mb-1">From</label>
                    <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className={inputCls} />
                </div>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">To</label>
                    <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className={inputCls} />
                </div>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Group</label>
                    <Select name="payrollreports-select-88" value={filters.group_id} onChange={e => setFilters(f => ({ ...f, group_id: e.target.value }))} options={[{ value: "", label: "All groups" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
                </div>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Department</label>
                    <Select name="payrollreports-select-89" value={filters.department_id} onChange={e => setFilters(f => ({ ...f, department_id: e.target.value }))} options={[{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
                </div>
                {selectedReport && (
                    <>
                        <button onClick={() => runReport(selectedReport)} className="px-4 py-2 bg-surface-raised hover:bg-line border border-line-strong text-fg text-sm font-medium rounded-nb transition-colors">
                            Apply Filters
                        </button>
                        <button
                            onClick={exportCsv}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
                        >
                            <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
                        </button>
                    </>
                )}
            </div>

            {/* Results */}
            {loading ? (
                <div className="h-64 bg-surface-raised/50 rounded-nb animate-pulse" />
            ) : !selectedReport ? (
                <EmptyState icon={BarChart3} title="Pick a report" description="Choose a report above to see results here." />
            ) : !result || result.rows.length === 0 ? (
                <EmptyState icon={BarChart3} title="No data" description="No rows match the selected filters." />
            ) : (
                <div className="bg-surface border border-line rounded-nb overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-surface-raised/50 border-b border-line">
                            <tr>
                                {result.columns.map(column => (
                                    <th key={column.key} className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider whitespace-nowrap">
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {result.rows.map((row, i) => (
                                <tr key={i} className="hover:bg-surface-raised/50 transition-colors">
                                    {result.columns.map(column => (
                                        <td key={column.key} className="px-4 py-2.5 text-sm text-fg whitespace-nowrap">
                                            {String(row[column.key] ?? '—')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        {result.totals && (
                            <tfoot className="bg-surface-raised/50 border-t border-line">
                                <tr>
                                    {result.columns.map(column => (
                                        <td key={column.key} className="px-4 py-2.5 text-sm font-semibold text-fg whitespace-nowrap">
                                            {result.totals && result.totals[column.key] !== undefined ? String(result.totals[column.key]) : ''}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </div>
    );
};

export default PayrollReportsPage;
