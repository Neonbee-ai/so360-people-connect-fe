import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: {
    dashboard: { get: vi.fn() },
    alerts: { list: vi.fn(), employees: vi.fn() },
  },
}));

import PayrollDashboardPage from './PayrollDashboardPage';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;

const run = {
  id: 'run-1', run_number: 7, status: 'review',
  period_start: '2026-08-01', period_end: '2026-08-31', pay_date: '2026-08-31',
  employee_count: 34, gross_total: 500000, deduction_total: 60000,
  employer_contribution_total: 45000, net_total: 440000, employer_cost_total: 545000,
};

const dashboard = {
  current_run: run,
  employees_included: 34,
  employees_excluded: 2,
  pending_approvals: 1,
  alerts: [{ key: 'missing_bank', label: 'Missing bank account', description: 'These employees have no bank account', count: 3, severity: 'blocking' }],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/people/payroll']}>
      <Routes>
        <Route path="/people/payroll" element={<PayrollDashboardPage />} />
        <Route path="/people/payroll/runs" element={<div>Runs list page</div>} />
        <Route path="/people/payroll/runs/:id" element={<div>Run detail page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.dashboard.get.mockResolvedValue(dashboard);
  mockApi.alerts.employees.mockResolvedValue({ data: [], total: 0 });
});

describe('GIVEN the dashboard header actions', () => {
  it('WHEN Open Current Run is clicked THEN it navigates to the run detail', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Open Current Run')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Open Current Run'));
    await waitFor(() => expect(screen.getByText('Run detail page')).toBeInTheDocument());
  });

  it('WHEN there is no run THEN the empty-state CTA routes to the runs page', async () => {
    mockApi.dashboard.get.mockResolvedValue({ current_run: null, alerts: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Start your first payroll run')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Start your first payroll run'));
    await waitFor(() => expect(screen.getByText('Runs list page')).toBeInTheDocument());
  });

  it('WHEN a run has no period dates THEN the header falls back to "Current period"', async () => {
    mockApi.dashboard.get.mockResolvedValue({
      ...dashboard,
      current_run: { ...run, period_start: undefined, period_end: undefined, pay_date: undefined },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/Current period/)).toBeInTheDocument());
  });

  it('WHEN the dashboard API fails THEN the page degrades to the no-run empty state', async () => {
    mockApi.dashboard.get.mockRejectedValue(new Error('down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    await waitFor(() => expect(screen.getByText('No payroll run in progress')).toBeInTheDocument());
    consoleSpy.mockRestore();
  });
});

describe('GIVEN the alert drawer lifecycle', () => {
  it('WHEN the drawer closes THEN the dashboard reloads to refresh alert counts', async () => {
    mockApi.alerts.employees.mockResolvedValue({
      data: [{ person_id: 'p1', person_name: 'Asha Nair', employee_code: 'EMP-9', department_name: 'Engineering', detail: 'No account on file' }],
      total: 1,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/Review employees/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Review employees/));
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    expect(screen.getByText('No account on file')).toBeInTheDocument();
    expect(screen.getByText('Fix').closest('a')).toHaveAttribute('href', '/people/people/p1?tab=payroll');
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(mockApi.dashboard.get.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('WHEN every affected employee is already fixed THEN the drawer reports the alert as resolved', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Review employees/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Review employees/));
    await waitFor(() => expect(screen.getByText(/No employees remaining/)).toBeInTheDocument());
  });

  it('WHEN loading the affected employees fails THEN the drawer stays open without a list', async () => {
    mockApi.alerts.employees.mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Review employees/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Review employees/));
    await waitFor(() => expect(mockApi.alerts.employees).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('WHEN an alert affects exactly one employee THEN the singular count copy is used', async () => {
    mockApi.dashboard.get.mockResolvedValue({
      ...dashboard,
      alerts: [{ key: 'missing_pan', label: 'Missing PAN', count: 1, severity: 'warning' }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/Review employees/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Review employees/));
    await waitFor(() => expect(screen.getByText('1 employee affected')).toBeInTheDocument());
  });
});
