import React, { useEffect, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import { toast, ChoiceCardGrid, SelectableCard, Skeleton, DataTable, DashboardPageTemplate } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import EmptyState from '../../components/EmptyState';
import { payrollApi, ReportResult, PayrollGroup } from '../../services/payrollApi';
import { departmentsApi } from '../../services/departmentsService';

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

/**
 * Older backends return `{ key, rows }` with no `columns`; rendering
 * `result.columns.map` then crashed the page ("a.columns is undefined").
 * Always hand the table arrays: derive columns from row keys when absent.
 */
export function normalizeReport(report: Partial<ReportResult> | null | undefined): ReportResult {
    const rows = Array.isArray(report?.rows) ? report!.rows : [];
    const columns = Array.isArray(report?.columns) && report!.columns.length
        ? report!.columns
        : [...new Set(rows.flatMap(r => Object.keys(r ?? {})))].map(key => ({
            key,
            label: key.split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        }));
    return { ...report, columns, rows } as ReportResult;
}

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
            setResult(normalizeReport(report));
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

    type ReportRow = Record<string, unknown> & { __totals?: boolean };
    const tableColumns: DataTableColumn<ReportRow>[] = (result?.columns ?? []).map(column => ({
        key: column.key,
        header: column.label,
        render: (row: ReportRow) => (
            row.__totals
                ? <span className="break-words text-fg">{result?.totals && result.totals[column.key] !== undefined ? String(result.totals[column.key]) : ''}</span>
                : <span className="break-words text-fg">{String(row[column.key] ?? '—')}</span>
        ),
    }));
    const tableRows: ReportRow[] = result
        ? [...(result.rows as ReportRow[]), ...(result.totals ? [{ __totals: true } as ReportRow] : [])]
        : [];

    return (
        <DashboardPageTemplate trail={[]}
            title="Payroll Reports"
            description="Registers, cost splits and statutory summaries"
            filters={{
                fields: [
                    { key: 'from', label: 'From', type: 'date' },
                    { key: 'to', label: 'To', type: 'date' },
                    { key: 'group_id', label: 'Group', type: 'select', options: groups.map(g => ({ value: g.id, label: g.name })) },
                    { key: 'department_id', label: 'Department', type: 'select', options: departments.map(d => ({ value: d.id, label: d.name })) },
                ],
                values: {
                    from: filters.from || undefined,
                    to: filters.to || undefined,
                    group_id: filters.group_id || undefined,
                    department_id: filters.department_id || undefined,
                },
                onChange: (v) => setFilters(f => ({
                    ...f,
                    from: (v.from as string) || '',
                    to: (v.to as string) || '',
                    group_id: (v.group_id as string) || '',
                    department_id: (v.department_id as string) || '',
                })),
                onClear: () => setFilters(f => ({ ...f, from: '', to: '', group_id: '', department_id: '' })),
            }}
            secondaryActions={selectedReport ? [
                { id: 'apply-filters', label: 'Apply filters', onSelect: () => runReport(selectedReport) },
                { id: 'export-csv', label: exporting ? 'Exporting…' : 'Export CSV', kind: 'export', icon: <Download />, onSelect: exportCsv, disabled: exporting },
            ] : undefined}
            primary={
                <ChoiceCardGrid
                    name="payroll-reports"
                    aria-label="Payroll reports"
                    value={selectedReport || undefined}
                    onChange={(key: string) => runReport(key)}
                >
                    {REPORTS.map(report => (
                        <SelectableCard
                            key={report.key}
                            value={report.key}
                            icon={FileSpreadsheet}
                            title={report.label}
                            description={report.description}
                        />
                    ))}
                </ChoiceCardGrid>
            }
            bottom={
                loading ? (
                    <Skeleton variant="rect" className="h-64" />
                ) : !selectedReport ? (
                    <EmptyState icon={BarChart3} title="Pick a report" description="Choose a report above to see results here." />
                ) : !result || result.rows.length === 0 ? (
                    <EmptyState icon={BarChart3} title="No data" description="No rows match the selected filters." />
                ) : (
                    <div className="min-w-0 max-w-full overflow-x-auto">
                        <DataTable name="payroll-report" columns={tableColumns} rows={tableRows} rowKey={(row) => String(tableRows.indexOf(row))} />
                    </div>
                )
            }
        />
    );
};

export default PayrollReportsPage;
