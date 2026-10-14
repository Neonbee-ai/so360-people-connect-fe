import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wallet } from 'lucide-react';
import { toast, Select } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import StatusChip from '../../components/payroll/StatusChip';
import { payrollApi, PayrollRun, PayrollPeriod } from '../../services/payrollApi';

const inputCls = 'w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary';

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

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Payroll Runs"
                subtitle="Process, review and close pay runs"
                actions={
                    <button
                        onClick={() => setShowNewRunDialog(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        <Plus size={16} /> New payroll run
                    </button>
                }
            />

            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-surface-raised/50 rounded-nb animate-pulse" />)}
                </div>
            ) : runs.length === 0 ? (
                <EmptyState
                    icon={Wallet}
                    title="No payroll runs yet"
                    description="Start your first payroll run to process salaries for an open pay period."
                    action={{ label: 'New payroll run', onClick: () => setShowNewRunDialog(true) }}
                />
            ) : (
                <div className="bg-surface border border-line rounded-nb overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-surface-raised/50 border-b border-line">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Run</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Period</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Group</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Employees</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Net Total</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Pay Date</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {runs.map(run => (
                                <tr key={run.id} className="hover:bg-surface-raised/50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-fg">#{run.run_number}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">
                                        {run.period_start && run.period_end
                                            ? `${formatters.formatDate(run.period_start)} – ${formatters.formatDate(run.period_end)}`
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">{run.payroll_group_name || '—'}</td>
                                    <td className="px-4 py-3 text-center"><StatusChip status={run.status} /></td>
                                    <td className="px-4 py-3 text-center text-sm text-fg-muted">{run.employee_count ?? '—'}</td>
                                    <td className="px-4 py-3 text-right text-sm text-fg">{formatters.formatCurrency(run.net_total || 0)}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">{formatters.formatDate(run.pay_date)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => navigate(`/people/payroll/runs/${run.id}`)} className="text-xs text-primary hover:text-primary transition-colors">Open</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <NewRunDialog
                isOpen={showNewRunDialog}
                onClose={() => setShowNewRunDialog(false)}
                onCreated={run => { setShowNewRunDialog(false); navigate(`/people/payroll/runs/${run.id}`); }}
            />
        </div>
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
        <Modal isOpen={isOpen} onClose={onClose} title="New Payroll Run" size="sm">
            <form onSubmit={handleCreate} className="space-y-4">
                {periods.length === 0 ? (
                    <p className="text-sm text-fg-muted">
                        No open pay periods. Generate periods in Payroll Configuration → Groups &amp; Periods first.
                    </p>
                ) : (
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Pay Period *</label>
                        <Select name="payrollruns-select-90" required value={periodId} onChange={e => setPeriodId(e.target.value)} options={[{ value: "", label: "Select an open period…" }, ...periods.map((period) => ({ value: period.id, label: `${period.period_start} – ${period.period_end}` }))]} />
                    </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                    <button
                        type="submit"
                        disabled={creating || !periodId}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        {creating ? 'Creating…' : 'Create Run'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default PayrollRunsPage;
