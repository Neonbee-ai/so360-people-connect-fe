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
  run_number: 3,
  status: 'draft',
  period_start: '2026-08-01',
  period_end: '2026-08-31',
  pay_date: '2026-08-31',
  employee_count: 2,
  gross_total: 100000,
  net_total: 90000,
};

const mockEmployees = [
  { id: 're1', run_id: 'run-1', person_id: 'p1', person_name: 'Asha Nair', status: 'pending' },
  { id: 're2', run_id: 'run-1', person_id: 'p2', person_name: 'Ravi Kumar', status: 'excluded', exclusion_reason: 'On sabbatical' },
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/people/payroll/runs/run-1']}>
      <Routes>
        <Route path="/people/payroll/runs/:id" element={<PayrollRunDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.runs.employees.mockResolvedValue({ data: mockEmployees, total: 2 });
  mockApi.alerts.list.mockResolvedValue({ data: [], total: 0 });
});

describe('GIVEN the status → step mapping', () => {
  it('WHEN mapping run statuses THEN each status lands on its lifecycle step', () => {
    expect(stepIndexForStatus('draft')).toBe(0);
    expect(stepIndexForStatus('calculating')).toBe(2);
    expect(stepIndexForStatus('review')).toBe(3);
    expect(stepIndexForStatus('pending_approval')).toBe(4);
    expect(stepIndexForStatus('approved')).toBe(5);
    expect(stepIndexForStatus('paid')).toBe(6);
    expect(stepIndexForStatus('closed')).toBe(7);
  });
});

describe('GIVEN a draft payroll run', () => {
  beforeEach(() => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'draft' });
  });

  it('WHEN the page loads THEN the stepper marks Prepare as the current step', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #3')).toBeInTheDocument());
    const prepareStep = screen.getByText('Prepare').closest('button') as HTMLButtonElement;
    expect(prepareStep).toHaveAttribute('aria-current', 'step');
  });

  it('WHEN the page loads THEN included and excluded employees list with reasons', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
    expect(screen.getByText('On sabbatical')).toBeInTheDocument();
  });

  it('WHEN the Calculate step is opened and Calculate is clicked THEN the calculate API is called', async () => {
    mockApi.runs.calculate.mockResolvedValue({ ...baseRun, status: 'calculating' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #3')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Calculate'));
    // Two elements carry the accessible name "Calculate": the stepper step and
    // the action button. The action button is rendered after the stepper.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Calculate' }).length).toBeGreaterThan(1));
    const calculateButtons = screen.getAllByRole('button', { name: 'Calculate' });
    fireEvent.click(calculateButtons[calculateButtons.length - 1]);
    await waitFor(() => expect(mockApi.runs.calculate).toHaveBeenCalledWith('run-1'));
  });

  it('WHEN the Approve step is viewed on a draft run THEN the Approve action is hidden', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #3')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(screen.getByText(/Approval becomes available/)).toBeInTheDocument());
    expect(screen.queryByText('Approve Run')).not.toBeInTheDocument();
  });

  it('WHEN a draft run renders THEN Reopen is not offered (illegal from draft)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #3')).toBeInTheDocument());
    expect(screen.queryByText('Reopen')).not.toBeInTheDocument();
  });
});

describe('GIVEN a run pending approval', () => {
  beforeEach(() => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'pending_approval' });
  });

  it('WHEN the page loads THEN the Approve step is current and the Approve action is available', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #3')).toBeInTheDocument());
    const approveStep = screen.getByText('Approve').closest('button') as HTMLButtonElement;
    expect(approveStep).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Approve Run')).toBeInTheDocument();
  });

  it('WHEN Approve Run is clicked THEN a confirmation with totals appears before the API call', async () => {
    mockApi.runs.approve.mockResolvedValue({ ...baseRun, status: 'approved' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Approve Run')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Approve Run'));
    await waitFor(() => expect(screen.getByText('Approve Payroll Run')).toBeInTheDocument());
    expect(mockApi.runs.approve).not.toHaveBeenCalled();
    // Page action + modal confirm share the label; the modal confirm is last.
    const approveButtons = screen.getAllByRole('button', { name: 'Approve Run' });
    fireEvent.click(approveButtons[approveButtons.length - 1]);
    await waitFor(() => expect(mockApi.runs.approve).toHaveBeenCalledWith('run-1'));
  });
});

describe('GIVEN a closed run', () => {
  beforeEach(() => {
    mockApi.runs.get.mockResolvedValue({
      ...baseRun, status: 'closed', posting_status: 'failed', payslips_generated: true,
    });
  });

  it('WHEN the page loads THEN the Close step shows posting failure with a retry action', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Accounting posting')).toBeInTheDocument());
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('WHEN a closed run renders THEN Cancel and Calculate actions are hidden', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #3')).toBeInTheDocument());
    expect(screen.queryByText('Cancel Run')).not.toBeInTheDocument();
    // Only the stepper's Calculate step remains — no Calculate action button.
    fireEvent.click(screen.getByText('Calculate'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Calculate' })).toHaveLength(1));
  });
});
