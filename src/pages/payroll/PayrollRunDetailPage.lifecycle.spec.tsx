import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: {
    runs: {
      get: vi.fn(),
      employees: vi.fn(),
      employeeLines: vi.fn(),
      calculate: vi.fn(),
      submitReview: vi.fn(),
      approve: vi.fn(),
      markPaid: vi.fn(),
      close: vi.fn(),
      reopen: vi.fn(),
      cancel: vi.fn(),
      exclude: vi.fn(),
      include: vi.fn(),
      postToAccounting: vi.fn(),
    },
    alerts: { list: vi.fn() },
  },
}));

import PayrollRunDetailPage, { stepIndexForStatus } from './PayrollRunDetailPage';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;

const baseRun = {
  id: 'run-1',
  run_number: 9,
  status: 'draft',
  period_start: '2026-08-01',
  period_end: '2026-08-31',
  pay_date: '2026-08-31',
  employee_count: 2,
  gross_total: 100000,
  deduction_total: 12000,
  employer_contribution_total: 9000,
  net_total: 88000,
  employer_cost_total: 109000,
};

const employees = [
  { id: 're1', run_id: 'run-1', person_id: 'p1', person_name: 'Asha Nair', department_name: 'Engineering', status: 'calculated', gross: 60000, total_deductions: 6000, net_pay: 54000, employer_cost: 66000, previous_net_pay: 50000 },
  { id: 're2', run_id: 'run-1', person_id: 'p2', person_name: 'Ravi Kumar', status: 'excluded', exclusion_reason: 'On sabbatical' },
  { id: 're3', run_id: 'run-1', person_id: 'p3', person_name: 'Meera Iyer', status: 'error', error_detail: 'No salary structure assigned' },
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/people/payroll/runs/run-1']}>
      <Routes>
        <Route path="/people/payroll/runs/:id" element={<PayrollRunDetailPage />} />
        <Route path="/people/payroll/runs" element={<div>Runs list page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.runs.employees.mockResolvedValue({ data: employees, total: 3 });
  mockApi.alerts.list.mockResolvedValue({ data: [], total: 0 });
});

describe('GIVEN the step mapping for edge statuses', () => {
  it('WHEN an unknown or cancelled status maps THEN it lands on the first step', () => {
    expect(stepIndexForStatus('cancelled' as any)).toBe(0);
    expect(stepIndexForStatus('paying')).toBe(5);
  });
});

describe('GIVEN a draft run (prepare step)', () => {
  beforeEach(() => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'draft' });
  });

  it('WHEN an employee is excluded with a reason THEN the exclude API receives it', async () => {
    mockApi.runs.exclude.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Exclude')[0]);
    await waitFor(() => expect(screen.getByText('Exclude Asha Nair')).toBeInTheDocument());
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Unpaid leave all month' } });
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(mockApi.runs.exclude).toHaveBeenCalledWith('run-1', 'p1', 'Unpaid leave all month'));
    // Run reloads after the action
    expect(mockApi.runs.get.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('WHEN the reason is blank THEN Confirm stays disabled and nothing is sent', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Exclude')[0]);
    await waitFor(() => expect(screen.getByText('Confirm')).toBeInTheDocument());
    expect(screen.getByText('Confirm')).toBeDisabled();
    fireEvent.click(screen.getByText('Confirm'));
    expect(mockApi.runs.exclude).not.toHaveBeenCalled();
    // Cancel closes the prompt
    fireEvent.click(screen.getAllByText('Cancel').pop() as HTMLElement);
    await waitFor(() => expect(screen.queryByText('Confirm')).not.toBeInTheDocument());
  });

  it('WHEN the reason prompt is dismissed via the backdrop THEN it closes without acting', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Exclude')[0]);
    await waitFor(() => expect(screen.getByText('Exclude Asha Nair')).toBeInTheDocument());
    fireEvent.click(document.querySelector('div.fixed.inset-0.bg-black\\/60') as Element);
    await waitFor(() => expect(screen.queryByText('Exclude Asha Nair')).not.toBeInTheDocument());
    expect(mockApi.runs.exclude).not.toHaveBeenCalled();
  });

  it('WHEN an excluded employee is included back THEN the include API is called', async () => {
    mockApi.runs.include.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Ravi Kumar')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Include'));
    await waitFor(() => expect(mockApi.runs.include).toHaveBeenCalledWith('run-1', 'p2'));
  });

  it('WHEN an action fails THEN the failure surfaces and the dialogs close', async () => {
    mockApi.runs.include.mockRejectedValue(new Error('Cannot include: missing bank account'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Ravi Kumar')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Include'));
    await waitFor(() => expect(mockApi.runs.include).toHaveBeenCalled());
    expect(screen.getByText('Payroll Run #9')).toBeInTheDocument();
  });

  it('WHEN Cancel Run is confirmed THEN the cancel API is called', async () => {
    mockApi.runs.cancel.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #9')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.getByText('Cancel Payroll Run')).toBeInTheDocument());
    expect(mockApi.runs.cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel Run'));
    await waitFor(() => expect(mockApi.runs.cancel).toHaveBeenCalledWith('run-1'));
  });

  it('WHEN the Validate step is opened with pending alerts THEN blocking issues list with counts', async () => {
    mockApi.alerts.list.mockResolvedValue({
      data: [
        { key: 'missing_bank', label: 'Missing bank account', count: 1, severity: 'blocking' },
        { key: 'resolved', label: 'Already fixed', count: 0 },
      ],
      total: 2,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #9')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Validate'));
    await waitFor(() => expect(screen.getByText('Missing bank account')).toBeInTheDocument());
    expect(screen.getByText('1 employee')).toBeInTheDocument();
    expect(screen.queryByText('Already fixed')).not.toBeInTheDocument();
  });

  it('WHEN there are no blocking alerts THEN the ready-to-calculate banner shows', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #9')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Validate'));
    await waitFor(() => expect(screen.getByText(/No blocking issues/)).toBeInTheDocument());
  });

  it('WHEN the Calculate step shows error rows THEN each error employee lists its detail', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #9')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Calculate'));
    await waitFor(() => expect(screen.getByText('Calculation Errors (1)')).toBeInTheDocument());
    expect(screen.getByText('Meera Iyer')).toBeInTheDocument();
    expect(screen.getByText('No salary structure assigned')).toBeInTheDocument();
  });
});

describe('GIVEN a run in review', () => {
  beforeEach(() => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'review', calculated_at: '2026-08-28T09:00:00Z' });
  });

  it('WHEN the page loads THEN the review table shows totals, variance and department', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Employee Pay Review')).toBeInTheDocument());
    expect(screen.getByText('$54,000.00')).toBeInTheDocument();
    expect(screen.getByText('+$4,000.00')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    // Excluded employee never appears in the review table
    expect(screen.queryByText('Ravi Kumar')).not.toBeInTheDocument();
  });

  it('WHEN a review row is expanded THEN component lines load once and render', async () => {
    mockApi.runs.employeeLines.mockResolvedValue({
      data: [
        { id: 'l1', run_employee_id: 're1', component_code: 'BASIC', component_name: 'Basic Salary', kind: 'earning', amount: 40000 },
        { id: 'l2', run_employee_id: 're1', component_code: 'PF_EMP', component_name: 'Provident Fund', kind: 'deduction', amount: 1800 },
      ],
      total: 2,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Employee Pay Review')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Toggle component lines for Asha Nair'));
    await waitFor(() => expect(screen.getByText('Basic Salary')).toBeInTheDocument());
    expect(screen.getByText('Provident Fund')).toBeInTheDocument();
    expect(mockApi.runs.employeeLines).toHaveBeenCalledWith('run-1', 're1');
    // Collapse and re-expand — cached, no second fetch
    fireEvent.click(screen.getByLabelText('Toggle component lines for Asha Nair'));
    await waitFor(() => expect(screen.queryByText('Basic Salary')).not.toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Toggle component lines for Asha Nair'));
    await waitFor(() => expect(screen.getByText('Basic Salary')).toBeInTheDocument());
    expect(mockApi.runs.employeeLines).toHaveBeenCalledTimes(1);
  });

  it('WHEN loading component lines fails THEN the row stays expandable', async () => {
    mockApi.runs.employeeLines.mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Employee Pay Review')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Toggle component lines for Asha Nair'));
    await waitFor(() => expect(mockApi.runs.employeeLines).toHaveBeenCalled());
  });

  it('WHEN Submit for Approval is confirmed THEN the submit-review API is called', async () => {
    mockApi.runs.submitReview.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Submit for Approval')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Submit for Approval'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Submit for Approval' })).toBeInTheDocument());
    const buttons = screen.getAllByRole('button', { name: 'Submit for Approval' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(mockApi.runs.submitReview).toHaveBeenCalledWith('run-1'));
  });

  it('WHEN the Calculate step is opened THEN the last-calculated line and Recalculate action show', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #9')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Calculate'));
    await waitFor(() => expect(screen.getByText(/Last calculated/)).toBeInTheDocument());
    expect(screen.getByText('Recalculate')).toBeInTheDocument();
  });

  it('WHEN Reopen is used with a reason THEN the reopen API receives it', async () => {
    mockApi.runs.reopen.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Reopen')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Reopen'));
    await waitFor(() => expect(screen.getByText('Reopen Run')).toBeInTheDocument());
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Attendance correction needed' } });
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(mockApi.runs.reopen).toHaveBeenCalledWith('run-1', 'Attendance correction needed'));
  });
});

describe('GIVEN a calculating run', () => {
  it('WHEN the page loads THEN the in-progress banner offers a refresh', async () => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'calculating' });
    renderPage();
    await waitFor(() => expect(screen.getByText(/Calculating salaries/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() => expect(mockApi.runs.get.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});

describe('GIVEN an approved run (pay step)', () => {
  beforeEach(() => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'approved' });
  });

  it('WHEN the page loads THEN the totals card and Mark as Paid are available', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Mark as Paid')).toBeInTheDocument());
    expect(screen.getByText('Gross Pay')).toBeInTheDocument();
    expect(screen.getByText('$109,000.00')).toBeInTheDocument();
  });

  it('WHEN Mark as Paid is confirmed THEN the mark-paid API is called', async () => {
    mockApi.runs.markPaid.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Mark as Paid')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Mark as Paid'));
    await waitFor(() => expect(screen.getByText('Mark Run as Paid')).toBeInTheDocument());
    const buttons = screen.getAllByRole('button', { name: 'Mark as Paid' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(mockApi.runs.markPaid).toHaveBeenCalledWith('run-1'));
  });

  it('WHEN the Approve step is viewed after approval THEN it reports the run as approved', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #9')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(screen.getByText('This run has been approved.')).toBeInTheDocument());
  });
});

describe('GIVEN a paid run (close step)', () => {
  beforeEach(() => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'paid', paid_at: '2026-08-31T12:00:00Z' });
  });

  it('WHEN Close Run is confirmed THEN the close API is called', async () => {
    mockApi.runs.close.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close Run' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Close Run' }));
    await waitFor(() => expect(screen.getByText('Close Payroll Run')).toBeInTheDocument());
    const buttons = screen.getAllByRole('button', { name: 'Close Run' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(mockApi.runs.close).toHaveBeenCalledWith('run-1'));
  });

  it('WHEN the Pay step is revisited THEN it shows the paid timestamp instead of the action', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #9')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Pay'));
    await waitFor(() => expect(screen.getByText(/^Paid /)).toBeInTheDocument());
    expect(screen.queryByText('Mark as Paid')).not.toBeInTheDocument();
  });
});

describe('GIVEN a closed run with failed posting', () => {
  beforeEach(() => {
    mockApi.runs.get.mockResolvedValue({
      ...baseRun, status: 'closed', posting_status: 'failed', payslips_generated: false,
    });
  });

  it('WHEN Retry is clicked THEN the posting is retried', async () => {
    mockApi.runs.postToAccounting.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Retry')).toBeInTheDocument());
    expect(screen.getByText('Pending')).toBeInTheDocument(); // payslips pending chip
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(mockApi.runs.postToAccounting).toHaveBeenCalledWith('run-1'));
  });
});

describe('GIVEN a run pending approval that is not yet paid', () => {
  it('WHEN the Pay and Close steps are viewed THEN the not-yet hints show', async () => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'pending_approval' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #9')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Pay'));
    await waitFor(() => expect(screen.getByText(/Payment becomes available once the run is approved/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => expect(screen.getByText(/Closing becomes available once the run has been paid/)).toBeInTheDocument());
  });
});

describe('GIVEN a cancelled run', () => {
  it('WHEN the page loads THEN only the audit banner shows — no stepper, no actions', async () => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'cancelled' });
    renderPage();
    await waitFor(() => expect(screen.getByText(/This run was cancelled/)).toBeInTheDocument());
    expect(screen.queryByText('Prepare')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });
});

describe('GIVEN navigation and failure states', () => {
  it('WHEN All Runs is clicked THEN the page navigates back to the list', async () => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun });
    renderPage();
    await waitFor(() => expect(screen.getByText('All Runs')).toBeInTheDocument());
    fireEvent.click(screen.getByText('All Runs'));
    await waitFor(() => expect(screen.getByText('Runs list page')).toBeInTheDocument());
  });

  it('WHEN the run fetch fails THEN the not-found message renders', async () => {
    mockApi.runs.get.mockRejectedValue(new Error('404'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll run not found.')).toBeInTheDocument());
  });

  it('WHEN employees or alerts fail but the run loads THEN the page still renders', async () => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun });
    mockApi.runs.employees.mockRejectedValue(new Error('down'));
    mockApi.alerts.list.mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #9')).toBeInTheDocument());
    expect(screen.getByText(/No employees are in this run yet/)).toBeInTheDocument();
  });
});
