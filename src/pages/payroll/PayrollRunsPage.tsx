import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wallet } from 'lucide-react';
import { toast, Select, Button, ListPageTemplate, DataTable, Modal, Stack, Cluster } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/payroll/StatusChip';
import { payrollApi, PayrollRun, PayrollPeriod } from '../../services/payrollApi';

const PayrollRunsPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });
    const [runs, setRuns] = useState<PayrollRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewRunDialog, setShowNewRunDialog] = useState(false);

    const loadRuns = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.runs.list();
            setRuns(result.data);
        } catch {
            toast.error('Failed to load payroll runs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadRuns(); }, [loadRuns]);

    const columns: DataTableColumn<PayrollRun>[] = [
        { key: 'run_number', header: 'Run', render: run => <span className="text-fg">#{run.run_number}</span> },
        {
            key: 'period',
            header: 'Period',
            render: run => (
                <span className="text-fg-muted">
                    {run.period_start && run.period_end
                        ? `${formatters.formatDate(run.period_start)} – ${formatters.formatDate(run.period_end)}`
                        : '—'}
                </span>
            ),
        },
        { key: 'payroll_group_name', header: 'Group', render: run => <span className="text-fg-muted">{run.payroll_group_name || '—'}</span> },
        { key: 'status', header: 'Status', align: 'center', render: run => <StatusChip status={run.status} /> },
        { key: 'employee_count', header: 'Employees', align: 'center', render: run => <span className="text-fg-muted">{run.employee_count ?? '—'}</span> },
        { key: 'net_total', header: 'Net Total', align: 'right', render: run => <span className="text-fg">{formatters.formatCurrency(run.net_total || 0)}</span> },
        { key: 'pay_date', header: 'Pay Date', render: run => <span className="text-fg-muted">{formatters.formatDate(run.pay_date)}</span> },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: run => (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/people/payroll/runs/${run.id}`)}>Open</Button>
            ),
        },
    ];

    return (
        <>
            <ListPageTemplate
                title="Payroll Runs"
                description="Process, review and close pay runs"
                loading={loading}
                isEmpty={runs.length === 0}
                primaryAction={
                    <Button onClick={() => setShowNewRunDialog(true)}>
                        <Plus size={16} /> New payroll run
                    </Button>
                }
                empty={
                    <EmptyState
                        icon={Wallet}
                        title="No payroll runs yet"
                        description="Start your first payroll run to process salaries for an open pay period."
                        action={{ label: 'New payroll run', onClick: () => setShowNewRunDialog(true) }}
                    />
                }
            >
                <DataTable name="payroll-runs" columns={columns} rows={runs} rowKey={run => run.id} />
            </ListPageTemplate>

            <NewRunDialog
                isOpen={showNewRunDialog}
                onClose={() => setShowNewRunDialog(false)}
                onCreated={run => { setShowNewRunDialog(false); navigate(`/people/payroll/runs/${run.id}`); }}
            />
        </>
    );
};

const NewRunDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreated: (run: PayrollRun) => void;
}> = ({ isOpen, onClose, onCreated }) => {
    const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
    const [periodId, setPeriodId] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        payrollApi.periods.list({ status: 'open' })
            .then(result => setPeriods(result.data))
            .catch(() => toast.error('Failed to load open periods'));
    }, [isOpen]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!periodId) return;
        try {
            setCreating(true);
            const run = await payrollApi.runs.create({ payroll_period_id: periodId });
            toast.success(`Payroll run #${run.run_number} created`);
            onCreated(run);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create payroll run');
        } finally {
            setCreating(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="New Payroll Run"
            size="sm"
            footer={
                <Cluster gap="default" justify="end">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="new-payroll-run-form" disabled={creating || !periodId}>
                        {creating ? 'Creating…' : 'Create Run'}
                    </Button>
                </Cluster>
            }
        >
            <form id="new-payroll-run-form" onSubmit={handleCreate}>
                <Stack gap="default">
                    {periods.length === 0 ? (
                        <p className="text-nb-body text-fg-muted">
                            No open pay periods. Generate periods in Payroll Configuration → Groups &amp; Periods first.
                        </p>
                    ) : (
                        <Select
                            name="payroll_period_id"
                            label="Pay Period"
                            required
                            value={periodId}
                            onChange={e => setPeriodId(e.target.value)}
                            options={[{ value: '', label: 'Select an open period…' }, ...periods.map(period => ({ value: period.id, label: `${period.period_start} – ${period.period_end}` }))]}
                        />
                    )}
                </Stack>
            </form>
        </Modal>
    );
};

export default PayrollRunsPage;
