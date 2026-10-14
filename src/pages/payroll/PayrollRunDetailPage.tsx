import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle, Circle, Ban, AlertTriangle, RefreshCw,
    UserMinus, UserPlus, ChevronDown, ChevronUp, Play, RotateCcw,
} from 'lucide-react';
import { toast } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import StatusChip from '../../components/payroll/StatusChip';
import {
    payrollApi, PayrollRun, PayrollRunEmployee, PayrollRunLine, PayrollAlert, RunStatus,
} from '../../services/payrollApi';

// =============================================================================
// Status → stepper mapping
// =============================================================================

const STEPS = ['prepare', 'validate', 'calculate', 'review', 'approve', 'pay', 'close'] as const;
type StepKey = typeof STEPS[number];

const STEP_LABELS: Record<StepKey, string> = {
    prepare: 'Prepare', validate: 'Validate', calculate: 'Calculate',
    review: 'Review', approve: 'Approve', pay: 'Pay', close: 'Close',
};

/** Index of the step the run is currently "at" for a given status. */
export function stepIndexForStatus(status: RunStatus): number {
    switch (status) {
        case 'draft': return 0;
        case 'calculating': return 2;
        case 'review': return 3;
        case 'pending_approval': return 4;
        case 'approved': return 5;
        case 'paying': return 5;
        case 'paid': return 6;
        case 'closed': return 7; // beyond the last step — everything complete
        default: return 0;
    }
}

const PayrollRunDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });

    const [run, setRun] = useState<PayrollRun | null>(null);
    const [employees, setEmployees] = useState<PayrollRunEmployee[]>([]);
    const [alerts, setAlerts] = useState<PayrollAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeStep, setActiveStep] = useState<StepKey | null>(null);
    const [acting, setActing] = useState(false);
    const [confirm, setConfirm] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => Promise<void> } | null>(null);
    const [reasonPrompt, setReasonPrompt] = useState<{ title: string; label: string; onSubmit: (reason: string) => Promise<void> } | null>(null);
    const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
    const [employeeLines, setEmployeeLines] = useState<Record<string, PayrollRunLine[]>>({});

    const load = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const [runResult, employeesResult, alertsResult] = await Promise.allSettled([
                payrollApi.runs.get(id),
                payrollApi.runs.employees(id),
                payrollApi.alerts.list(),
            ]);
            if (runResult.status === 'fulfilled') setRun(runResult.value);
            else throw runResult.reason;
            if (employeesResult.status === 'fulfilled') setEmployees(employeesResult.value.data);
            if (alertsResult.status === 'fulfilled') setAlerts(alertsResult.value.data);
        } catch {
            toast.error('Failed to load payroll run');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const currentIndex = run ? stepIndexForStatus(run.status) : 0;
    const shownStep: StepKey = activeStep ?? STEPS[Math.min(currentIndex, STEPS.length - 1)];

    const included = useMemo(() => employees.filter(e => e.status !== 'excluded'), [employees]);
    const excluded = useMemo(() => employees.filter(e => e.status === 'excluded'), [employees]);
    const errorRows = useMemo(() => employees.filter(e => e.status === 'error'), [employees]);

    const act = async (action: () => Promise<unknown>, successMessage: string) => {
        if (!id) return;
        try {
            setActing(true);
            await action();
            toast.success(successMessage);
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Action failed');
        } finally {
            setActing(false);
            setConfirm(null);
            setReasonPrompt(null);
        }
    };

    const toggleLines = async (employee: PayrollRunEmployee) => {
        if (expandedEmployeeId === employee.id) { setExpandedEmployeeId(null); return; }
        setExpandedEmployeeId(employee.id);
        if (!employeeLines[employee.id] && id) {
            try {
                const result = await payrollApi.runs.employeeLines(id, employee.id);
                setEmployeeLines(prev => ({ ...prev, [employee.id]: result.data }));
            } catch {
                toast.error('Failed to load component lines');
            }
        }
    };

    if (loading) {
        return <div className="p-6"><div className="h-96 bg-surface-raised/50 rounded-nb animate-pulse" /></div>;
    }
    if (!run || !id) {
        return <div className="p-6 text-sm text-fg-muted">Payroll run not found.</div>;
    }

    const isDraft = run.status === 'draft';
    const canCalculate = run.status === 'draft' || run.status === 'review';
    const canSubmitReview = run.status === 'review';
    const canApprove = run.status === 'pending_approval';
    const canMarkPaid = run.status === 'approved';
    const canClose = run.status === 'paid';
    const canReopen = run.status === 'review' || run.status === 'pending_approval';
    const canCancel = ['draft', 'calculating', 'review', 'pending_approval'].includes(run.status);
    const isClosed = run.status === 'closed';
    const isCancelled = run.status === 'cancelled';

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title={`Payroll Run #${run.run_number}`}
                subtitle={`${run.period_start ? formatters.formatDate(run.period_start) : ''} – ${run.period_end ? formatters.formatDate(run.period_end) : ''} · Pay date ${formatters.formatDate(run.pay_date)}`}
                actions={
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/people/payroll/runs')} className="flex items-center gap-1.5 px-3 py-2 text-sm text-fg-muted hover:text-fg transition-colors">
                            <ArrowLeft size={14} /> All Runs
                        </button>
                        <StatusChip status={run.status} />
                        {canReopen && (
                            <button
                                onClick={() => setReasonPrompt({
                                    title: 'Reopen Run',
                                    label: 'Why is this run being reopened?',
                                    onSubmit: reason => act(() => payrollApi.runs.reopen(id, reason), 'Run reopened'),
                                })}
                                className="flex items-center gap-1.5 px-3 py-2 bg-surface-raised hover:bg-line border border-line-strong text-fg text-xs font-medium rounded-nb transition-colors"
                            >
                                <RotateCcw size={12} /> Reopen
                            </button>
                        )}
                        {canCancel && (
                            <button
                                onClick={() => setConfirm({
                                    title: 'Cancel Payroll Run',
                                    message: `This will cancel run #${run.run_number}. Nothing will be paid and the period reopens for a new run.`,
                                    confirmLabel: 'Cancel Run',
                                    onConfirm: () => act(() => payrollApi.runs.cancel(id), 'Run cancelled'),
                                })}
                                className="flex items-center gap-1.5 px-3 py-2 bg-danger/10 hover:bg-danger-hover/20 border border-danger/30 text-danger text-xs font-medium rounded-nb transition-colors"
                            >
                                <Ban size={12} /> Cancel
                            </button>
                        )}
                    </div>
                }
            />

            {isCancelled && (
                <div className="flex items-center gap-3 px-4 py-3 bg-surface-raised/50 rounded-nb border border-line-strong">
                    <Ban size={16} className="text-fg-subtle" />
                    <span className="text-sm text-fg-muted">This run was cancelled. It is kept for audit only.</span>
                </div>
            )}

            {/* Stepper */}
            {!isCancelled && (
                <div className="bg-surface border border-line rounded-nb p-5">
                    <div className="flex items-center gap-0">
                        {STEPS.map((step, index) => {
                            const isCompleted = currentIndex > index;
                            const isCurrent = currentIndex === index;
                            const isLast = index === STEPS.length - 1;
                            return (
                                <React.Fragment key={step}>
                                    <button
                                        onClick={() => setActiveStep(step)}
                                        className="flex flex-col items-center focus:outline-none"
                                        aria-current={isCurrent ? 'step' : undefined}
                                    >
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                                            isCompleted ? 'bg-primary text-primary-fg' :
                                            isCurrent ? 'bg-primary/20 border-2 border-primary text-primary' :
                                            'bg-surface-raised border border-line-strong text-fg-subtle'
                                        }`}>
                                            {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                        </div>
                                        <span className={`text-xs mt-2 text-center w-16 ${
                                            shownStep === step ? 'text-primary font-semibold' :
                                            isCompleted || isCurrent ? 'text-primary' : 'text-fg-subtle'
                                        }`}>
                                            {STEP_LABELS[step]}
                                        </span>
                                    </button>
                                    {!isLast && <div className={`flex-1 h-0.5 min-w-4 ${isCompleted ? 'bg-primary' : 'bg-line'}`} />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step content */}
            {!isCancelled && (
                <div className="bg-surface border border-line rounded-nb p-5 space-y-4">
                    {/* PREPARE */}
                    {shownStep === 'prepare' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-fg">Included Employees ({included.length})</h3>
                            {included.length === 0 ? (
                                <p className="text-sm text-fg-muted">No employees are in this run yet. Employees join based on their payroll group.</p>
                            ) : (
                                <div className="divide-y divide-line border border-line rounded-nb overflow-hidden">
                                    {included.map(employee => (
                                        <div key={employee.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-raised/50 transition-colors">
                                            <div>
                                                <span className="text-sm text-fg">{employee.person_name}</span>
                                                <span className="text-xs text-fg-subtle ml-2">{[employee.employee_code, employee.department_name].filter(Boolean).join(' · ')}</span>
                                            </div>
                                            {isDraft && (
                                                <button
                                                    onClick={() => setReasonPrompt({
                                                        title: `Exclude ${employee.person_name}`,
                                                        label: 'Why is this employee excluded from this run?',
                                                        onSubmit: reason => act(() => payrollApi.runs.exclude(id, employee.person_id, reason), `${employee.person_name} excluded`),
                                                    })}
                                                    className="flex items-center gap-1 text-xs text-danger hover:text-danger transition-colors"
                                                >
                                                    <UserMinus size={12} /> Exclude
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {excluded.length > 0 && (
                                <>
                                    <h3 className="text-sm font-semibold text-fg">Excluded Employees ({excluded.length})</h3>
                                    <div className="divide-y divide-line border border-line rounded-nb overflow-hidden">
                                        {excluded.map(employee => (
                                            <div key={employee.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-raised/50 transition-colors">
                                                <div>
                                                    <span className="text-sm text-fg-muted">{employee.person_name}</span>
                                                    {employee.exclusion_reason && <span className="text-xs text-warning/80 ml-2">{employee.exclusion_reason}</span>}
                                                </div>
                                                {isDraft && (
                                                    <button
                                                        onClick={() => act(() => payrollApi.runs.include(id, employee.person_id), `${employee.person_name} included`)}
                                                        className="flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors"
                                                    >
                                                        <UserPlus size={12} /> Include
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* VALIDATE */}
                    {shownStep === 'validate' && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-fg">Blocking Issues</h3>
                            {alerts.filter(a => a.count > 0).length === 0 ? (
                                <div className="flex items-center gap-2 px-4 py-3 bg-success/5 border border-success/30 rounded-nb">
                                    <CheckCircle size={15} className="text-success" />
                                    <span className="text-sm text-success">No blocking issues — this run is ready to calculate.</span>
                                </div>
                            ) : (
                                alerts.filter(a => a.count > 0).map(alert => (
                                    <div key={alert.key} className="flex items-center justify-between px-4 py-3 bg-warning/5 border border-warning/30 rounded-nb">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={14} className="text-warning" />
                                            <span className="text-sm text-fg">{alert.label}</span>
                                        </div>
                                        <span className="text-xs text-warning">{alert.count} employee{alert.count === 1 ? '' : 's'}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* CALCULATE */}
                    {shownStep === 'calculate' && (
                        <div className="space-y-4">
                            {run.status === 'calculating' ? (
                                <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/30 rounded-nb">
                                    <RefreshCw size={15} className="text-primary animate-spin" />
                                    <span className="text-sm text-primary">Calculating salaries… refresh to see progress.</span>
                                    <button onClick={load} className="text-xs text-primary hover:text-primary ml-auto">Refresh</button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-fg-muted">
                                        {run.calculated_at
                                            ? `Last calculated ${formatters.formatDateTime(run.calculated_at)}.`
                                            : 'Salaries have not been calculated yet.'}
                                    </p>
                                    {canCalculate && (
                                        <button
                                            onClick={() => act(() => payrollApi.runs.calculate(id), 'Calculation started')}
                                            disabled={acting}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
                                        >
                                            <Play size={14} /> {run.calculated_at ? 'Recalculate' : 'Calculate'}
                                        </button>
                                    )}
                                </div>
                            )}
                            {errorRows.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-danger uppercase tracking-wider">Calculation Errors ({errorRows.length})</h4>
                                    {errorRows.map(employee => (
                                        <div key={employee.id} className="px-4 py-2.5 bg-danger/5 border border-danger/30 rounded-nb">
                                            <div className="text-sm text-fg">{employee.person_name}</div>
                                            <div className="text-xs text-danger">{employee.error_detail || 'Unknown calculation error'}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* REVIEW */}
                    {shownStep === 'review' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-fg">Employee Pay Review</h3>
                                {canSubmitReview && (
                                    <button
                                        onClick={() => setConfirm({
                                            title: 'Submit for Approval',
                                            message: `Send run #${run.run_number} (${included.length} employees, net ${formatters.formatCurrency(run.net_total || 0)}) for approval?`,
                                            confirmLabel: 'Submit for Approval',
                                            onConfirm: () => act(() => payrollApi.runs.submitReview(id), 'Submitted for approval'),
                                        })}
                                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                                    >
                                        Submit for Approval
                                    </button>
                                )}
                            </div>
                            <div className="border border-line rounded-nb overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-surface-raised/50 border-b border-line">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Employee</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Gross</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Deductions</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Net</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Employer Cost</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">vs Last Run</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-fg-muted uppercase tracking-wider" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {included.map(employee => {
                                            const variance = employee.previous_net_pay != null && employee.net_pay != null
                                                ? employee.net_pay - employee.previous_net_pay : null;
                                            const isExpanded = expandedEmployeeId === employee.id;
                                            return (
                                                <React.Fragment key={employee.id}>
                                                    <tr className="hover:bg-surface-raised/50 transition-colors">
                                                        <td className="px-4 py-2.5">
                                                            <div className="text-sm text-fg">{employee.person_name}</div>
                                                            <div className="text-xs text-fg-subtle">{employee.department_name}</div>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-sm text-fg">{formatters.formatCurrency(employee.gross || 0)}</td>
                                                        <td className="px-4 py-2.5 text-right text-sm text-fg">{formatters.formatCurrency(employee.total_deductions || 0)}</td>
                                                        <td className="px-4 py-2.5 text-right text-sm font-medium text-fg">{formatters.formatCurrency(employee.net_pay || 0)}</td>
                                                        <td className="px-4 py-2.5 text-right text-sm text-fg">{formatters.formatCurrency(employee.employer_cost || 0)}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs">
                                                            {variance === null ? <span className="text-fg-subtle">—</span> : (
                                                                <span className={variance >= 0 ? 'text-success' : 'text-danger'}>
                                                                    {variance >= 0 ? '+' : ''}{formatters.formatCurrency(variance)}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <button
                                                                onClick={() => toggleLines(employee)}
                                                                aria-label={`Toggle component lines for ${employee.person_name}`}
                                                                className="p-1 rounded text-fg-muted hover:text-fg hover:bg-surface-raised"
                                                            >
                                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={7} className="px-6 py-3 bg-surface-raised/30">
                                                                {!employeeLines[employee.id] ? (
                                                                    <div className="h-8 bg-surface-raised/60 rounded animate-pulse" />
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        {employeeLines[employee.id].map(line => (
                                                                            <div key={line.id} className="flex items-center justify-between text-xs">
                                                                                <div className="flex items-center gap-2">
                                                                                    <StatusChip status={line.kind} />
                                                                                    <span className="text-fg">{line.component_name}</span>
                                                                                </div>
                                                                                <span className="text-fg">{formatters.formatCurrency(line.amount)}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* APPROVE */}
                    {shownStep === 'approve' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-sm font-semibold text-fg">Approval</h3>
                            <TotalsCard run={run} formatCurrency={formatters.formatCurrency} />
                            {canApprove ? (
                                <button
                                    onClick={() => setConfirm({
                                        title: 'Approve Payroll Run',
                                        message: `Approve run #${run.run_number}: ${run.employee_count || included.length} employees, net payout ${formatters.formatCurrency(run.net_total || 0)}. After approval, amounts can no longer be changed.`,
                                        confirmLabel: 'Approve Run',
                                        onConfirm: () => act(() => payrollApi.runs.approve(id), 'Run approved'),
                                    })}
                                    disabled={acting}
                                    className="w-full px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
                                >
                                    Approve Run
                                </button>
                            ) : (
                                <p className="text-sm text-fg-muted">
                                    {currentIndex > 4 ? 'This run has been approved.' : 'Approval becomes available once the run is submitted for approval.'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* PAY */}
                    {shownStep === 'pay' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-sm font-semibold text-fg">Payment</h3>
                            <TotalsCard run={run} formatCurrency={formatters.formatCurrency} />
                            {canMarkPaid ? (
                                <button
                                    onClick={() => setConfirm({
                                        title: 'Mark Run as Paid',
                                        message: `Confirm that ${formatters.formatCurrency(run.net_total || 0)} has been paid out to ${run.employee_count || included.length} employees for run #${run.run_number}.`,
                                        confirmLabel: 'Mark as Paid',
                                        onConfirm: () => act(() => payrollApi.runs.markPaid(id), 'Run marked as paid'),
                                    })}
                                    disabled={acting}
                                    className="w-full px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
                                >
                                    Mark as Paid
                                </button>
                            ) : (
                                <p className="text-sm text-fg-muted">
                                    {currentIndex > 5 ? `Paid ${run.paid_at ? formatters.formatDateTime(run.paid_at) : ''}.` : 'Payment becomes available once the run is approved.'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* CLOSE */}
                    {shownStep === 'close' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-sm font-semibold text-fg">Close Run</h3>
                            {canClose && (
                                <button
                                    onClick={() => setConfirm({
                                        title: 'Close Payroll Run',
                                        message: `This will close run #${run.run_number} and generate ${run.employee_count || included.length} payslips. A closed run can never be modified again.`,
                                        confirmLabel: 'Close Run',
                                        onConfirm: () => act(() => payrollApi.runs.close(id), 'Run closed'),
                                    })}
                                    disabled={acting}
                                    className="w-full px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
                                >
                                    Close Run
                                </button>
                            )}
                            {isClosed && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-4 py-3 bg-surface-raised/50 border border-line-strong rounded-nb">
                                        <span className="text-sm text-fg">Payslip generation</span>
                                        <StatusChip status={run.payslips_generated ? 'posted' : 'pending'} label={run.payslips_generated ? 'Generated' : 'Pending'} />
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-3 bg-surface-raised/50 border border-line-strong rounded-nb">
                                        <span className="text-sm text-fg">Accounting posting</span>
                                        <div className="flex items-center gap-2">
                                            <StatusChip status={run.posting_status || 'not_posted'} />
                                            {run.posting_status === 'failed' && (
                                                <button
                                                    onClick={() => act(() => payrollApi.runs.postToAccounting(id), 'Posting retried')}
                                                    className="flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors"
                                                >
                                                    <RefreshCw size={12} /> Retry
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!canClose && !isClosed && (
                                <p className="text-sm text-fg-muted">Closing becomes available once the run has been paid.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation dialog for irreversible steps */}
            <Modal isOpen={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title || ''} size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-fg">{confirm?.message}</p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-line">
                        <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                        <button
                            onClick={() => confirm?.onConfirm()}
                            disabled={acting}
                            className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
                        >
                            {confirm?.confirmLabel}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Reason prompt (exclude / reopen) */}
            <Modal isOpen={!!reasonPrompt} onClose={() => setReasonPrompt(null)} title={reasonPrompt?.title || ''} size="sm">
                <ReasonForm
                    label={reasonPrompt?.label || 'Reason'}
                    onCancel={() => setReasonPrompt(null)}
                    onSubmit={reason => reasonPrompt?.onSubmit(reason)}
                    busy={acting}
                />
            </Modal>
        </div>
    );
};

const TotalsCard: React.FC<{ run: PayrollRun; formatCurrency: (v: number) => string }> = ({ run, formatCurrency }) => (
    <div className="bg-surface-raised/50 border border-line-strong rounded-nb p-4 space-y-2">
        {[
            ['Employees', String(run.employee_count ?? 0)],
            ['Gross Pay', formatCurrency(run.gross_total || 0)],
            ['Deductions', formatCurrency(run.deduction_total || 0)],
            ['Employer Contributions', formatCurrency(run.employer_contribution_total || 0)],
            ['Net Payout', formatCurrency(run.net_total || 0)],
            ['Total Employer Cost', formatCurrency(run.employer_cost_total || 0)],
        ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-fg-muted">{label}</span>
                <span className="text-fg font-medium">{value}</span>
            </div>
        ))}
    </div>
);

const ReasonForm: React.FC<{
    label: string;
    busy: boolean;
    onCancel: () => void;
    onSubmit: (reason: string) => void;
}> = ({ label, busy, onCancel, onSubmit }) => {
    const [reason, setReason] = useState('');
    return (
        <form onSubmit={e => { e.preventDefault(); if (reason.trim()) onSubmit(reason.trim()); }} className="space-y-4">
            <div>
                <label className="block text-xs text-fg-muted mb-1">{label} *</label>
                <textarea
                    required
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-line">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                <button type="submit" disabled={busy || !reason.trim()} className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors">
                    Confirm
                </button>
            </div>
        </form>
    );
};

export default PayrollRunDetailPage;
