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


describe('GIVEN the Comb payroll run detail', () => {
  it('WHEN a draft run loads THEN title, status and the seven stepper steps render', async () => {
    mockApi.runs.get.mockResolvedValue(baseRun);
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #3')).toBeInTheDocument());
    for (const step of ['Prepare', 'Validate', 'Calculate', 'Review', 'Approve', 'Pay', 'Close']) {
      expect(screen.getByText(step).closest('button')).not.toBeNull();
    }
    expect(screen.getByRole('button', { name: /All Runs/ })).toBeInTheDocument();
  });

  it('WHEN Exclude is clicked on a draft run THEN a reason dialog submits the exclusion', async () => {
    mockApi.runs.get.mockResolvedValue(baseRun);
    mockApi.runs.exclude.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Exclude/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Leave' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(mockApi.runs.exclude).toHaveBeenCalledWith('run-1', 'p1', 'Leave'));
  });

  it('WHEN Cancel is clicked THEN a confirm dialog gates the cancellation', async () => {
    mockApi.runs.get.mockResolvedValue(baseRun);
    mockApi.runs.cancel.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll Run #3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Cancel run' }));
    await waitFor(() => expect(screen.getByText('Cancel Payroll Run')).toBeInTheDocument());
    expect(mockApi.runs.cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Run' }));
    await waitFor(() => expect(mockApi.runs.cancel).toHaveBeenCalledWith('run-1'));
  });

  it('WHEN the run is cancelled THEN the audit notice shows and the stepper is hidden', async () => {
    mockApi.runs.get.mockResolvedValue({ ...baseRun, status: 'cancelled' });
    renderPage();
    await waitFor(() => expect(screen.getByText(/This run was cancelled/)).toBeInTheDocument());
    expect(screen.queryByText('Prepare')).not.toBeInTheDocument();
  });

  it('WHEN the run is missing THEN a not-found message renders', async () => {
    mockApi.runs.get.mockRejectedValue(new Error('nope'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Payroll run not found.')).toBeInTheDocument());
  });
});
