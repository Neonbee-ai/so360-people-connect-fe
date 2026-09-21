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
        return <div className="p-6"><div className="h-96 bg-slate-800/50 rounded-xl animate-pulse" /></div>;
    }
    if (!run || !id) {
        return <div className="p-6 text-sm text-slate-400">Payroll run not found.</div>;
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
                        <button onClick={() => navigate('/people/payroll/runs')} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">
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
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
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
                                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-medium rounded-lg transition-colors"
                            >
                                <Ban size={12} /> Cancel
                            </button>
                        )}
                    </div>
                }
            />

            {isCancelled && (
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <Ban size={16} className="text-slate-500" />
                    <span className="text-sm text-slate-400">This run was cancelled. It is kept for audit only.</span>
                </div>
            )}

            {/* Stepper */}
            {!isCancelled && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
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
                                            isCompleted ? 'bg-teal-500 text-white' :
                                            isCurrent ? 'bg-teal-500/20 border-2 border-teal-500 text-teal-400' :
                                            'bg-slate-800 border border-slate-600 text-slate-600'
                                        }`}>
                                            {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                        </div>
                                        <span className={`text-xs mt-2 text-center w-16 ${
                                            shownStep === step ? 'text-teal-300 font-semibold' :
                                            isCompleted || isCurrent ? 'text-teal-400' : 'text-slate-600'
                                        }`}>
                                            {STEP_LABELS[step]}
                                        </span>
                                    </button>
                                    {!isLast && <div className={`flex-1 h-0.5 min-w-4 ${isCompleted ? 'bg-teal-500' : 'bg-slate-700'}`} />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step content */}
            {!isCancelled && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    {/* PREPARE */}
                    {shownStep === 'prepare' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-50">Included Employees ({included.length})</h3>
                            {included.length === 0 ? (
                                <p className="text-sm text-slate-400">No employees are in this run yet. Employees join based on their payroll group.</p>
                            ) : (
                                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                                    {included.map(employee => (
                                        <div key={employee.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition-colors">
                                            <div>
                                                <span className="text-sm text-slate-50">{employee.person_name}</span>
                                                <span className="text-xs text-slate-500 ml-2">{[employee.employee_code, employee.department_name].filter(Boolean).join(' · ')}</span>
                                            </div>
                                            {isDraft && (
                                                <button
                                                    onClick={() => setReasonPrompt({
                                                        title: `Exclude ${employee.person_name}`,
                                                        label: 'Why is this employee excluded from this run?',
                                                        onSubmit: reason => act(() => payrollApi.runs.exclude(id, employee.person_id, reason), `${employee.person_name} excluded`),
                                                    })}
                                                    className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors"
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
                                    <h3 className="text-sm font-semibold text-slate-50">Excluded Employees ({excluded.length})</h3>
                                    <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                                        {excluded.map(employee => (
                                            <div key={employee.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition-colors">
                                                <div>
                                                    <span className="text-sm text-slate-400">{employee.person_name}</span>
                                                    {employee.exclusion_reason && <span className="text-xs text-amber-400/80 ml-2">{employee.exclusion_reason}</span>}
                                                </div>
                                                {isDraft && (
                                                    <button
                                                        onClick={() => act(() => payrollApi.runs.include(id, employee.person_id), `${employee.person_name} included`)}
                                                        className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
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
                            <h3 className="text-sm font-semibold text-slate-50">Blocking Issues</h3>
                            {alerts.filter(a => a.count > 0).length === 0 ? (
                                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/5 border border-emerald-500/30 rounded-lg">
                                    <CheckCircle size={15} className="text-emerald-400" />
                                    <span className="text-sm text-emerald-400">No blocking issues — this run is ready to calculate.</span>
                                </div>
                            ) : (
                                alerts.filter(a => a.count > 0).map(alert => (
                                    <div key={alert.key} className="flex items-center justify-between px-4 py-3 bg-amber-500/5 border border-amber-500/30 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={14} className="text-amber-400" />
                                            <span className="text-sm text-slate-200">{alert.label}</span>
                                        </div>
                                        <span className="text-xs text-amber-400">{alert.count} employee{alert.count === 1 ? '' : 's'}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* CALCULATE */}
                    {shownStep === 'calculate' && (
                        <div className="space-y-4">
                            {run.status === 'calculating' ? (
                                <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
                                    <RefreshCw size={15} className="text-blue-400 animate-spin" />
                                    <span className="text-sm text-blue-400">Calculating salaries… refresh to see progress.</span>
                                    <button onClick={load} className="text-xs text-teal-400 hover:text-teal-300 ml-auto">Refresh</button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-slate-400">
                                        {run.calculated_at
                                            ? `Last calculated ${formatters.formatDateTime(run.calculated_at)}.`
                                            : 'Salaries have not been calculated yet.'}
                                    </p>
                                    {canCalculate && (
                                        <button
                                            onClick={() => act(() => payrollApi.runs.calculate(id), 'Calculation started')}
                                            disabled={acting}
                                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            <Play size={14} /> {run.calculated_at ? 'Recalculate' : 'Calculate'}
                                        </button>
                                    )}
                                </div>
                            )}
                            {errorRows.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Calculation Errors ({errorRows.length})</h4>
                                    {errorRows.map(employee => (
                                        <div key={employee.id} className="px-4 py-2.5 bg-rose-500/5 border border-rose-500/30 rounded-lg">
                                            <div className="text-sm text-slate-50">{employee.person_name}</div>
                                            <div className="text-xs text-rose-400">{employee.error_detail || 'Unknown calculation error'}</div>
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
                                <h3 className="text-sm font-semibold text-slate-50">Employee Pay Review</h3>
                                {canSubmitReview && (
                                    <button
                                        onClick={() => setConfirm({
                                            title: 'Submit for Approval',
                                            message: `Send run #${run.run_number} (${included.length} employees, net ${formatters.formatCurrency(run.net_total || 0)}) for approval?`,
                                            confirmLabel: 'Submit for Approval',
                                            onConfirm: () => act(() => payrollApi.runs.submitReview(id), 'Submitted for approval'),
                                        })}
                                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        Submit for Approval
                                    </button>
                                )}
                            </div>
                            <div className="border border-slate-800 rounded-xl overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-800/50 border-b border-slate-800">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Employee</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Gross</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Deductions</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Net</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Employer Cost</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">vs Last Run</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wider" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {included.map(employee => {
                                            const variance = employee.previous_net_pay != null && employee.net_pay != null
                                                ? employee.net_pay - employee.previous_net_pay : null;
                                            const isExpanded = expandedEmployeeId === employee.id;
                                            return (
                                                <React.Fragment key={employee.id}>
                                                    <tr className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-4 py-2.5">
                                                            <div className="text-sm text-slate-50">{employee.person_name}</div>
                                                            <div className="text-xs text-slate-500">{employee.department_name}</div>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-sm text-slate-300">{formatters.formatCurrency(employee.gross || 0)}</td>
                                                        <td className="px-4 py-2.5 text-right text-sm text-slate-300">{formatters.formatCurrency(employee.total_deductions || 0)}</td>
                                                        <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-50">{formatters.formatCurrency(employee.net_pay || 0)}</td>
                                                        <td className="px-4 py-2.5 text-right text-sm text-slate-300">{formatters.formatCurrency(employee.employer_cost || 0)}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs">
                                                            {variance === null ? <span className="text-slate-600">—</span> : (
                                                                <span className={variance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                                    {variance >= 0 ? '+' : ''}{formatters.formatCurrency(variance)}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <button
                                                                onClick={() => toggleLines(employee)}
                                                                aria-label={`Toggle component lines for ${employee.person_name}`}
                                                                className="p-1 rounded text-slate-400 hover:text-slate-50 hover:bg-slate-800"
                                                            >
                                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={7} className="px-6 py-3 bg-slate-800/30">
                                                                {!employeeLines[employee.id] ? (
                                                                    <div className="h-8 bg-slate-800/60 rounded animate-pulse" />
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        {employeeLines[employee.id].map(line => (
                                                                            <div key={line.id} className="flex items-center justify-between text-xs">
                                                                                <div className="flex items-center gap-2">
                                                                                    <StatusChip status={line.kind} />
                                                                                    <span className="text-slate-300">{line.component_name}</span>
                                                                                </div>
                                                                                <span className="text-slate-200">{formatters.formatCurrency(line.amount)}</span>
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
                            <h3 className="text-sm font-semibold text-slate-50">Approval</h3>
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
                                    className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Approve Run
                                </button>
                            ) : (
                                <p className="text-sm text-slate-400">
                                    {currentIndex > 4 ? 'This run has been approved.' : 'Approval becomes available once the run is submitted for approval.'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* PAY */}
                    {shownStep === 'pay' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-sm font-semibold text-slate-50">Payment</h3>
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
                                    className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Mark as Paid
                                </button>
                            ) : (
                                <p className="text-sm text-slate-400">
                                    {currentIndex > 5 ? `Paid ${run.paid_at ? formatters.formatDateTime(run.paid_at) : ''}.` : 'Payment becomes available once the run is approved.'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* CLOSE */}
                    {shownStep === 'close' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-sm font-semibold text-slate-50">Close Run</h3>
                            {canClose && (
                                <button
                                    onClick={() => setConfirm({
                                        title: 'Close Payroll Run',
                                        message: `This will close run #${run.run_number} and generate ${run.employee_count || included.length} payslips. A closed run can never be modified again.`,
                                        confirmLabel: 'Close Run',
                                        onConfirm: () => act(() => payrollApi.runs.close(id), 'Run closed'),
                                    })}
                                    disabled={acting}
                                    className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Close Run
                                </button>
                            )}
                            {isClosed && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <span className="text-sm text-slate-300">Payslip generation</span>
                                        <StatusChip status={run.payslips_generated ? 'posted' : 'pending'} label={run.payslips_generated ? 'Generated' : 'Pending'} />
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <span className="text-sm text-slate-300">Accounting posting</span>
                                        <div className="flex items-center gap-2">
                                            <StatusChip status={run.posting_status || 'not_posted'} />
                                            {run.posting_status === 'failed' && (
                                                <button
                                                    onClick={() => act(() => payrollApi.runs.postToAccounting(id), 'Posting retried')}
                                                    className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                                >
                                                    <RefreshCw size={12} /> Retry
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!canClose && !isClosed && (
                                <p className="text-sm text-slate-400">Closing becomes available once the run has been paid.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation dialog for irreversible steps */}
            <Modal isOpen={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title || ''} size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-slate-300">{confirm?.message}</p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                        <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                        <button
                            onClick={() => confirm?.onConfirm()}
                            disabled={acting}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
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
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
        {[
            ['Employees', String(run.employee_count ?? 0)],
            ['Gross Pay', formatCurrency(run.gross_total || 0)],
            ['Deductions', formatCurrency(run.deduction_total || 0)],
            ['Employer Contributions', formatCurrency(run.employer_contribution_total || 0)],
            ['Net Payout', formatCurrency(run.net_total || 0)],
            ['Total Employer Cost', formatCurrency(run.employer_cost_total || 0)],
        ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-50 font-medium">{value}</span>
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
                <label className="block text-xs text-slate-400 mb-1">{label} *</label>
                <textarea
                    required
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={busy || !reason.trim()} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                    Confirm
                </button>
            </div>
        </form>
    );
};

export default PayrollRunDetailPage;
