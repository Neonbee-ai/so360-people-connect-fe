import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import {
    Wallet, Users, UserMinus, TrendingUp, TrendingDown,
    Landmark, DollarSign, CheckCircle, AlertTriangle, ArrowRight, Play,
} from 'lucide-react';
import { toast } from '@so360/design-system';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/payroll/StatusChip';
import AlertDrawer from '../../components/payroll/AlertDrawer';
import { payrollApi, PayrollDashboard, PayrollAlert } from '../../services/payrollApi';

const PayrollDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });
    const [dashboard, setDashboard] = useState<PayrollDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeAlert, setActiveAlert] = useState<PayrollAlert | null>(null);

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.dashboard.get();
            setDashboard(result);
        } catch (error) {
            console.error('Failed to load payroll dashboard:', error);
            toast.error('Failed to load payroll dashboard');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadDashboard(); }, [loadDashboard]);

    const run = dashboard?.current_run || null;
    const alerts = dashboard?.alerts || [];

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Payroll Dashboard"
                subtitle="Current pay run at a glance, with anything blocking it"
                actions={run && (
                    <button
                        onClick={() => navigate(`/people/payroll/runs/${run.id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        Open Current Run <ArrowRight size={14} />
                    </button>
                )}
            />

            {loading ? (
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-surface-raised/50 rounded-nb animate-pulse" />)}
                </div>
            ) : !run ? (
                <EmptyState
                    icon={Wallet}
                    title="No payroll run in progress"
                    description="Start your first payroll run to begin processing salaries for this organization."
                    action={{ label: 'Start your first payroll run', onClick: () => navigate('/people/payroll/runs') }}
                />
            ) : (
                <>
                    {/* Current run header */}
                    <div className="bg-surface border border-line rounded-nb p-5 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-semibold text-fg">
                                    Run #{run.run_number}
                                </h2>
                                <StatusChip status={run.status} />
                            </div>
                            <p className="text-sm text-fg-muted mt-1">
                                {run.period_start && run.period_end
                                    ? `${formatters.formatDate(run.period_start)} – ${formatters.formatDate(run.period_end)}`
                                    : 'Current period'}
                                {run.pay_date ? ` · Pay date ${formatters.formatDate(run.pay_date)}` : ''}
                            </p>
                        </div>
                        <Play size={20} className="text-primary" />
                    </div>

                    {/* KPI cards */}
                    <div className="grid grid-cols-4 gap-4">
                        <StatCard label="Employees Included" value={dashboard?.employees_included ?? run.employee_count ?? 0} icon={Users} color="teal" />
                        <StatCard label="Employees Excluded" value={dashboard?.employees_excluded ?? 0} icon={UserMinus} color="amber" />
                        <StatCard label="Gross Pay" value={formatters.formatCurrency(run.gross_total || 0)} icon={TrendingUp} color="emerald" />
                        <StatCard label="Deductions" value={formatters.formatCurrency(run.deduction_total || 0)} icon={TrendingDown} color="rose" />
                        <StatCard label="Employer Contributions" value={formatters.formatCurrency(run.employer_contribution_total || 0)} icon={Landmark} color="purple" />
                        <StatCard label="Net Pay" value={formatters.formatCurrency(run.net_total || 0)} icon={Wallet} color="teal" />
                        <StatCard label="Employer Cost" value={formatters.formatCurrency(run.employer_cost_total || 0)} icon={DollarSign} color="blue" />
                        <StatCard label="Pending Approvals" value={dashboard?.pending_approvals ?? run.pending_approval_count ?? 0} icon={CheckCircle} color="amber" />
                    </div>
                </>
            )}

            {/* Alerts panel */}
            {!loading && (
                <div className="bg-surface border border-line rounded-nb">
                    <div className="px-5 py-4 border-b border-line flex items-center gap-2">
                        <AlertTriangle size={16} className="text-warning" />
                        <h3 className="text-sm font-semibold text-fg">Payroll Alerts</h3>
                    </div>
                    {alerts.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-fg-muted">
                            No alerts — everyone is payroll-ready.
                        </div>
                    ) : (
                        <div className="divide-y divide-line">
                            {alerts.map(alert => (
                                <div key={alert.key} className="px-5 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg text-sm font-semibold ${
                                            alert.severity === 'blocking' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                                        }`}>
                                            {alert.count}
                                        </span>
                                        <div>
                                            <div className="text-sm font-medium text-fg">{alert.label}</div>
                                            {alert.description && <div className="text-xs text-fg-muted">{alert.description}</div>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveAlert(alert)}
                                        className="flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors"
                                    >
                                        Review employees <ArrowRight size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <AlertDrawer alert={activeAlert} onClose={() => { setActiveAlert(null); loadDashboard(); }} />
        </div>
    );
};

export default PayrollDashboardPage;
