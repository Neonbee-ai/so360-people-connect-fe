import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import {
    Wallet, Users, UserMinus, TrendingUp, TrendingDown,
    Landmark, DollarSign, CheckCircle, ArrowRight, Play,
} from 'lucide-react';
import { toast, Button, Badge, Card, Cluster, Stack, Skeleton, DashboardPageTemplate, KpiCard } from '@so360/design-system';
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

    const kpis = run && !loading ? [
        <KpiCard key="included" label="Employees Included" value={dashboard?.employees_included ?? run.employee_count ?? 0} icon={Users} />,
        <KpiCard key="excluded" label="Employees Excluded" value={dashboard?.employees_excluded ?? 0} icon={UserMinus} />,
        <KpiCard key="gross" label="Gross Pay" value={formatters.formatCurrency(run.gross_total || 0)} icon={TrendingUp} />,
        <KpiCard key="deductions" label="Deductions" value={formatters.formatCurrency(run.deduction_total || 0)} icon={TrendingDown} />,
        <KpiCard key="employer-contrib" label="Employer Contributions" value={formatters.formatCurrency(run.employer_contribution_total || 0)} icon={Landmark} />,
        <KpiCard key="net" label="Net Pay" value={formatters.formatCurrency(run.net_total || 0)} icon={Wallet} />,
        <KpiCard key="employer-cost" label="Employer Cost" value={formatters.formatCurrency(run.employer_cost_total || 0)} icon={DollarSign} />,
        <KpiCard key="pending" label="Pending Approvals" value={dashboard?.pending_approvals ?? run.pending_approval_count ?? 0} icon={CheckCircle} />,
    ] : undefined;

    return (
        <>
            <DashboardPageTemplate trail={[]}
                title="Payroll Dashboard"
                description="Current pay run at a glance, with anything blocking it"
                primaryAction={run ? (
                    <Button onClick={() => navigate(`/people/payroll/runs/${run.id}`)}>
                        Open Current Run <ArrowRight size={14} />
                    </Button>
                ) : undefined}
                kpis={kpis}
                primary={loading ? (
                    <Skeleton variant="rect" className="h-28" />
                ) : !run ? (
                    <EmptyState
                        icon={Wallet}
                        title="No payroll run in progress"
                        description="Start your first payroll run to begin processing salaries for this organization."
                        action={{ label: 'Start your first payroll run', onClick: () => navigate('/people/payroll/runs') }}
                    />
                ) : (
                    <Card name="current-run">
                        <Cluster gap="default" justify="between" align="center">
                            <Stack gap="tight">
                                <Cluster gap="default" align="center">
                                    <h2 className="text-nb-title text-fg">Run #{run.run_number}</h2>
                                    <StatusChip status={run.status} />
                                </Cluster>
                                <p className="text-nb-body text-fg-muted">
                                    {run.period_start && run.period_end
                                        ? `${formatters.formatDate(run.period_start)} – ${formatters.formatDate(run.period_end)}`
                                        : 'Current period'}
                                    {run.pay_date ? ` · Pay date ${formatters.formatDate(run.pay_date)}` : ''}
                                </p>
                            </Stack>
                            <Play size={20} className="text-primary" />
                        </Cluster>
                    </Card>
                )}
                bottom={!loading ? (
                    <Card title="Payroll Alerts" name="payroll-alerts" padding="none">
                        {alerts.length === 0 ? (
                            <div className="px-5 py-8 text-center text-nb-body text-fg-muted">
                                No alerts — everyone is payroll-ready.
                            </div>
                        ) : (
                            <Stack gap="none">
                                {alerts.map(alert => (
                                    <div key={alert.key} className="px-5 py-3 border-b border-line last:border-b-0">
                                        <Cluster gap="default" justify="between" align="center">
                                            <Cluster gap="default" align="center">
                                                <Badge tone={alert.severity === 'blocking' ? 'danger' : 'warning'}>{alert.count}</Badge>
                                                <Stack gap="none">
                                                    <span className="text-nb-body text-fg">{alert.label}</span>
                                                    {alert.description && <span className="text-nb-caption text-fg-muted">{alert.description}</span>}
                                                </Stack>
                                            </Cluster>
                                            <Button variant="ghost" size="sm" onClick={() => setActiveAlert(alert)}>
                                                Review employees <ArrowRight size={12} />
                                            </Button>
                                        </Cluster>
                                    </div>
                                ))}
                            </Stack>
                        )}
                    </Card>
                ) : undefined}
            />

            <AlertDrawer alert={activeAlert} onClose={() => { setActiveAlert(null); loadDashboard(); }} />
        </>
    );
};

export default PayrollDashboardPage;
