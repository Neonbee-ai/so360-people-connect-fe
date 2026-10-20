import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    CheckCircle, Circle, Ban, AlertTriangle, RefreshCw,
    UserMinus, UserPlus, ChevronDown, ChevronUp, Play, RotateCcw,
} from 'lucide-react';
import { toast, Button, IconButton, Card, Modal, ConfirmDialog, Stack, Cluster, Skeleton, Textarea, DetailPageTemplate, DataTable } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
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
        return <Skeleton variant="rect" className="h-96" />;
    }
    if (!run || !id) {
        return <p className="text-nb-body text-fg-muted">Payroll run not found.</p>;
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

    const reviewColumns: DataTableColumn<PayrollRunEmployee>[] = [
        { key: 'employee', header: 'Employee', render: e => (
            <Stack gap="none">
                <span className="text-nb-body text-fg">{e.person_name}</span>
                <span className="text-nb-caption text-fg-subtle">{e.department_name}</span>
            </Stack>
        ) },
        { key: 'gross', header: 'Gross', align: 'right', render: e => formatters.formatCurrency(e.gross || 0) },
        { key: 'deductions', header: 'Deductions', align: 'right', render: e => formatters.formatCurrency(e.total_deductions || 0) },
        { key: 'net', header: 'Net', align: 'right', render: e => <span className="text-fg">{formatters.formatCurrency(e.net_pay || 0)}</span> },
        { key: 'employer_cost', header: 'Employer Cost', align: 'right', render: e => formatters.formatCurrency(e.employer_cost || 0) },
        { key: 'variance', header: 'vs Last Run', align: 'right', render: e => {
            const variance = e.previous_net_pay != null && e.net_pay != null ? e.net_pay - e.previous_net_pay : null;
            return variance === null ? <span className="text-fg-subtle">—</span> : (
                <span className={variance >= 0 ? 'text-success' : 'text-danger'}>
                    {variance >= 0 ? '+' : ''}{formatters.formatCurrency(variance)}
                </span>
            );
        } },
        { key: 'lines', header: '', align: 'right', render: e => {
            const isExpanded = expandedEmployeeId === e.id;
            return (
                <Stack gap="tight">
                    <IconButton
                        icon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        label={`Toggle component lines for ${e.person_name}`}
                        hideTooltip
                        onClick={() => toggleLines(e)}
                    />
                    {isExpanded && (!employeeLines[e.id] ? (
                        <Skeleton variant="rect" className="h-8" />
                    ) : (
                        <Stack gap="tight">
                            {employeeLines[e.id].map(line => (
                                <Cluster key={line.id} gap="default" justify="between" align="center">
                                    <Cluster gap="tight" align="center">
                                        <StatusChip status={line.kind} />
                                        <span className="text-nb-caption text-fg">{line.component_name}</span>
                                    </Cluster>
                                    <span className="text-nb-caption text-fg">{formatters.formatCurrency(line.amount)}</span>
                                </Cluster>
                            ))}
                        </Stack>
                    ))}
                </Stack>
            );
        } },
    ];

    // Next workflow step = the single header primary; everything else is secondary / overflow.
    const askConfirm = (title: string, message: string, confirmLabel: string, run_: () => Promise<unknown> | void, success: string) =>
        setConfirm({ title, message, confirmLabel, onConfirm: () => act(run_ as () => Promise<unknown>, success) });
    const employeeCount = run.employee_count || included.length;

    let primaryAction: React.ReactNode = undefined;
    if (canSubmitReview) {
        primaryAction = (
            <Button
                key="submit-review"
                onClick={() => askConfirm(
                    'Submit for Approval',
                    `Send run #${run.run_number} (${included.length} employees, net ${formatters.formatCurrency(run.net_total || 0)}) for approval?`,
                    'Submit for Approval',
                    () => payrollApi.runs.submitReview(id),
                    'Submitted for approval',
                )}
                disabled={acting}
            >
                Submit for Approval
            </Button>
        );
    } else if (canApprove) {
        primaryAction = (
            <Button
                key="approve"
                onClick={() => askConfirm(
                    'Approve Payroll Run',
                    `Approve run #${run.run_number}: ${employeeCount} employees, net payout ${formatters.formatCurrency(run.net_total || 0)}. After approval, amounts can no longer be changed.`,
                    'Approve Run',
                    () => payrollApi.runs.approve(id),
                    'Run approved',
                )}
                disabled={acting}
            >
                Approve Run
            </Button>
        );
    } else if (canMarkPaid) {
        primaryAction = (
            <Button
                key="mark-paid"
                onClick={() => askConfirm(
                    'Mark Run as Paid',
                    `Confirm that ${formatters.formatCurrency(run.net_total || 0)} has been paid out to ${employeeCount} employees for run #${run.run_number}.`,
                    'Mark as Paid',
                    () => payrollApi.runs.markPaid(id),
                    'Run marked as paid',
                )}
                disabled={acting}
            >
                Mark as Paid
            </Button>
        );
    } else if (canClose) {
        primaryAction = (
            <Button
                key="close-run"
                onClick={() => askConfirm(
                    'Close Payroll Run',
                    `This will close run #${run.run_number} and generate ${employeeCount} payslips. A closed run can never be modified again.`,
                    'Close Run',
                    () => payrollApi.runs.close(id),
                    'Run closed',
                )}
                disabled={acting}
            >
                Close Run
            </Button>
        );
    } else if (canCalculate && run.status === 'draft') {
        primaryAction = (
            <Button key="calculate" onClick={() => act(() => payrollApi.runs.calculate(id), 'Calculation started')} disabled={acting}>
                <Play size={14} /> Calculate salaries
            </Button>
        );
    }

    const secondaryActions: React.ReactNode[] = [
        ...(canCalculate && run.status !== 'draft' ? [
            <Button key="recalculate" variant="secondary" onClick={() => act(() => payrollApi.runs.calculate(id), 'Calculation started')} disabled={acting}>
                <Play size={14} /> Recalculate
            </Button>,
        ] : []),
        ...(canReopen ? [
            <Button
                key="reopen"
                variant="secondary"
                onClick={() => setReasonPrompt({
                    title: 'Reopen Run',
                    label: 'Why is this run being reopened?',
                    onSubmit: reason => act(() => payrollApi.runs.reopen(id, reason), 'Run reopened'),
                })}
            >
                <RotateCcw size={12} /> Reopen
            </Button>,
        ] : []),
    ];

    const overflowActions = canCancel ? [{
        label: 'Cancel run',
        danger: true,
        disabled: acting,
        onSelect: () => setConfirm({
            title: 'Cancel Payroll Run',
            message: `This will cancel run #${run.run_number}. Nothing will be paid and the period reopens for a new run.`,
            confirmLabel: 'Cancel Run',
            onConfirm: () => act(() => payrollApi.runs.cancel(id), 'Run cancelled'),
        }),
    }] : undefined;

    return (
        <>
            <DetailPageTemplate
                title={`Payroll Run #${run.run_number}`}
                meta={`${run.period_start ? formatters.formatDate(run.period_start) : ''} – ${run.period_end ? formatters.formatDate(run.period_end) : ''} · Pay date ${formatters.formatDate(run.pay_date)}`}
                status={<StatusChip status={run.status} />}
                trail={[{ label: 'All Runs', to: '/people/payroll/runs', onClick: () => navigate('/people/payroll/runs') }]}
                primaryAction={primaryAction}
                secondaryActions={secondaryActions}
                overflowActions={overflowActions}
            >
                <Stack gap="default">
                    {isCancelled && (
                        <Card name="run-cancelled">
                            <Cluster gap="default" align="center">
                                <Ban size={16} className="text-fg-subtle" />
                                <span className="text-nb-body text-fg-muted">This run was cancelled. It is kept for audit only.</span>
                            </Cluster>
                        </Card>
                    )}

                    {/* Stepper */}
                    {!isCancelled && (
                        <Card name="run-stepper">
                            <Cluster gap="tight" align="center">
                                {STEPS.map((step, index) => {
                                    const isCompleted = currentIndex > index;
                                    const isCurrent = currentIndex === index;
                                    return (
                                        <Button
                                            key={step}
                                            variant={shownStep === step ? 'secondary' : 'ghost'}
                                            size="sm"
                                            onClick={() => setActiveStep(step)}
                                            aria-current={isCurrent ? 'step' : undefined}
                                        >
                                            {isCompleted ? <CheckCircle className="size-4" /> : <Circle className="size-4" />}
                                            <span className={isCompleted || isCurrent ? 'text-primary' : 'text-fg-subtle'}>{STEP_LABELS[step]}</span>
                                        </Button>
                                    );
                                })}
                            </Cluster>
                        </Card>
                    )}

                    {/* Step content */}
                    {!isCancelled && (
                        <Card name="run-step">
                            <Stack gap="default">
                                {/* PREPARE */}
                                {shownStep === 'prepare' && (
                                    <Stack gap="default">
                                        <h3 className="text-nb-title text-fg">Included Employees ({included.length})</h3>
                                        {included.length === 0 ? (
                                            <p className="text-nb-body text-fg-muted">No employees are in this run yet. Employees join based on their payroll group.</p>
                                        ) : (
                                            <Stack gap="tight">
                                                {included.map(employee => (
                                                    <Cluster key={employee.id} gap="default" justify="between" align="center">
                                                        <div>
                                                            <span className="text-nb-body text-fg">{employee.person_name}</span>
                                                            <span className="text-nb-caption text-fg-subtle ml-2">{[employee.employee_code, employee.department_name].filter(Boolean).join(' · ')}</span>
                                                        </div>
                                                        {isDraft && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setReasonPrompt({
                                                                    title: `Exclude ${employee.person_name}`,
                                                                    label: 'Why is this employee excluded from this run?',
                                                                    onSubmit: reason => act(() => payrollApi.runs.exclude(id, employee.person_id, reason), `${employee.person_name} excluded`),
                                                                })}
                                                            >
                                                                <UserMinus size={12} /> Exclude
                                                            </Button>
                                                        )}
                                                    </Cluster>
                                                ))}
                                            </Stack>
                                        )}
                                        {excluded.length > 0 && (
                                            <>
                                                <h3 className="text-nb-title text-fg">Excluded Employees ({excluded.length})</h3>
                                                <Stack gap="tight">
                                                    {excluded.map(employee => (
                                                        <Cluster key={employee.id} gap="default" justify="between" align="center">
                                                            <div>
                                                                <span className="text-nb-body text-fg-muted">{employee.person_name}</span>
                                                                {employee.exclusion_reason && <span className="text-nb-caption text-warning ml-2">{employee.exclusion_reason}</span>}
                                                            </div>
                                                            {isDraft && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => act(() => payrollApi.runs.include(id, employee.person_id), `${employee.person_name} included`)}
                                                                >
                                                                    <UserPlus size={12} /> Include
                                                                </Button>
                                                            )}
                                                        </Cluster>
                                                    ))}
                                                </Stack>
                                            </>
                                        )}
                                    </Stack>
                                )}

                                {/* VALIDATE */}
                                {shownStep === 'validate' && (
                                    <Stack gap="tight">
                                        <h3 className="text-nb-title text-fg">Blocking Issues</h3>
                                        {alerts.filter(a => a.count > 0).length === 0 ? (
                                            <Cluster gap="tight" align="center">
                                                <CheckCircle size={15} className="text-success" />
                                                <span className="text-nb-body text-success">No blocking issues — this run is ready to calculate.</span>
                                            </Cluster>
                                        ) : (
                                            alerts.filter(a => a.count > 0).map(alert => (
                                                <Cluster key={alert.key} gap="default" justify="between" align="center">
                                                    <Cluster gap="tight" align="center">
                                                        <AlertTriangle size={14} className="text-warning" />
                                                        <span className="text-nb-body text-fg">{alert.label}</span>
                                                    </Cluster>
                                                    <span className="text-nb-caption text-warning">{alert.count} employee{alert.count === 1 ? '' : 's'}</span>
                                                </Cluster>
                                            ))
                                        )}
                                    </Stack>
                                )}

                                {/* CALCULATE */}
                                {shownStep === 'calculate' && (
                                    <Stack gap="default">
                                        {run.status === 'calculating' ? (
                                            <Cluster gap="default" align="center">
                                                <RefreshCw size={15} className="text-primary animate-spin" />
                                                <span className="text-nb-body text-primary">Calculating salaries… refresh to see progress.</span>
                                                <Button variant="ghost" size="sm" onClick={load}>Refresh</Button>
                                            </Cluster>
                                        ) : (
                                            <Cluster gap="default" justify="between" align="center">
                                                <p className="text-nb-body text-fg-muted">
                                                    {run.calculated_at
                                                        ? `Last calculated ${formatters.formatDateTime(run.calculated_at)}.`
                                                        : 'Salaries have not been calculated yet.'}
                                                </p>
                                            </Cluster>
                                        )}
                                        {errorRows.length > 0 && (
                                            <Stack gap="tight">
                                                <h4 className="text-nb-caption text-danger">Calculation Errors ({errorRows.length})</h4>
                                                {errorRows.map(employee => (
                                                    <div key={employee.id}>
                                                        <div className="text-nb-body text-fg">{employee.person_name}</div>
                                                        <div className="text-nb-caption text-danger">{employee.error_detail || 'Unknown calculation error'}</div>
                                                    </div>
                                                ))}
                                            </Stack>
                                        )}
                                    </Stack>
                                )}

                                {/* REVIEW */}
                                {shownStep === 'review' && (
                                    <Stack gap="default">
                                        <h3 className="text-nb-title text-fg">Employee Pay Review</h3>
                                        <DataTable name="payroll-run-review" rows={included} columns={reviewColumns} rowKey={e => e.id} />
                                    </Stack>
                                )}

                                {/* APPROVE */}
                                {shownStep === 'approve' && (
                                    <Stack gap="default">
                                        <h3 className="text-nb-title text-fg">Approval</h3>
                                        <TotalsCard run={run} formatCurrency={formatters.formatCurrency} />
                                        {canApprove ? (
                                            <p className="text-nb-body text-fg-muted">Use “Approve Run” at the top of the page to approve this payroll run.</p>
                                        ) : (
                                            <p className="text-nb-body text-fg-muted">
                                                {currentIndex > 4 ? 'This run has been approved.' : 'Approval becomes available once the run is submitted for approval.'}
                                            </p>
                                        )}
                                    </Stack>
                                )}

                                {/* PAY */}
                                {shownStep === 'pay' && (
                                    <Stack gap="default">
                                        <h3 className="text-nb-title text-fg">Payment</h3>
                                        <TotalsCard run={run} formatCurrency={formatters.formatCurrency} />
                                        {canMarkPaid ? (
                                            <p className="text-nb-body text-fg-muted">Use “Mark as Paid” at the top of the page once the payout is complete.</p>
                                        ) : (
                                            <p className="text-nb-body text-fg-muted">
                                                {currentIndex > 5 ? `Paid ${run.paid_at ? formatters.formatDateTime(run.paid_at) : ''}.` : 'Payment becomes available once the run is approved.'}
                                            </p>
                                        )}
                                    </Stack>
                                )}

                                {/* CLOSE */}
                                {shownStep === 'close' && (
                                    <Stack gap="default">
                                        <h3 className="text-nb-title text-fg">Close Run</h3>
                                        {canClose && (
                                            <p className="text-nb-body text-fg-muted">Use “Close Run” at the top of the page to close this run and generate payslips.</p>
                                        )}
                                        {isClosed && (
                                            <Stack gap="tight">
                                                <Cluster gap="default" justify="between" align="center">
                                                    <span className="text-nb-body text-fg">Payslip generation</span>
                                                    <StatusChip status={run.payslips_generated ? 'posted' : 'pending'} label={run.payslips_generated ? 'Generated' : 'Pending'} />
                                                </Cluster>
                                                <Cluster gap="default" justify="between" align="center">
                                                    <span className="text-nb-body text-fg">Accounting posting</span>
                                                    <Cluster gap="tight" align="center">
                                                        <StatusChip status={run.posting_status || 'not_posted'} />
                                                        {run.posting_status === 'failed' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => act(() => payrollApi.runs.postToAccounting(id), 'Posting retried')}
                                                            >
                                                                <RefreshCw size={12} /> Retry
                                                            </Button>
                                                        )}
                                                    </Cluster>
                                                </Cluster>
                                            </Stack>
                                        )}
                                        {!canClose && !isClosed && (
                                            <p className="text-nb-body text-fg-muted">Closing becomes available once the run has been paid.</p>
                                        )}
                                    </Stack>
                                )}
                            </Stack>
                        </Card>
                    )}
                </Stack>
            </DetailPageTemplate>

            {/* Confirmation dialog for irreversible steps */}
            <ConfirmDialog
                open={!!confirm}
                title={confirm?.title || ''}
                message={confirm?.message}
                confirmLabel={confirm?.confirmLabel}
                onConfirm={() => confirm?.onConfirm()}
                onCancel={() => setConfirm(null)}
            />

            {/* Reason prompt (exclude / reopen) */}
            <Modal
                open={!!reasonPrompt}
                onClose={() => setReasonPrompt(null)}
                title={reasonPrompt?.title || ''}
                size="sm"
                footer={<ReasonFooter busy={acting} onCancel={() => setReasonPrompt(null)} />}
            >
                <ReasonForm
                    label={reasonPrompt?.label || 'Reason'}
                    onSubmit={reason => reasonPrompt?.onSubmit(reason)}
                />
            </Modal>
        </>
    );
};

const TotalsCard: React.FC<{ run: PayrollRun; formatCurrency: (v: number) => string }> = ({ run, formatCurrency }) => (
    <Card name="run-totals">
        <Stack gap="tight">
            {[
                ['Employees', String(run.employee_count ?? 0)],
                ['Gross Pay', formatCurrency(run.gross_total || 0)],
                ['Deductions', formatCurrency(run.deduction_total || 0)],
                ['Employer Contributions', formatCurrency(run.employer_contribution_total || 0)],
                ['Net Payout', formatCurrency(run.net_total || 0)],
                ['Total Employer Cost', formatCurrency(run.employer_cost_total || 0)],
            ].map(([label, value]) => (
                <Cluster key={label} gap="default" justify="between" align="center">
                    <span className="text-nb-body text-fg-muted">{label}</span>
                    <span className="text-nb-body text-fg">{value}</span>
                </Cluster>
            ))}
        </Stack>
    </Card>
);

const REASON_FORM_ID = 'payroll-run-reason-form';

// The submit button lives in the modal footer, so it needs the form's validity
// from outside; ReasonForm reports it through a shared DOM form attribute.
const ReasonFooter: React.FC<{ busy: boolean; onCancel: () => void }> = ({ busy, onCancel }) => (
    <Cluster gap="default" justify="end">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" form={REASON_FORM_ID} disabled={busy}>Confirm</Button>
    </Cluster>
);

const ReasonForm: React.FC<{
    label: string;
    onSubmit: (reason: string) => void;
}> = ({ label, onSubmit }) => {
    const [reason, setReason] = useState('');
    return (
        <form id={REASON_FORM_ID} onSubmit={e => { e.preventDefault(); if (reason.trim()) onSubmit(reason.trim()); }}>
            <Textarea
                name="reason"
                label={label}
                required
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
            />
        </form>
    );
};

export default PayrollRunDetailPage;
