import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

const renderPage = () => render(<MemoryRouter><PayrollDashboardPage /></MemoryRouter>);

const mockRun = {
  id: 'run-1',
  run_number: 7,
  status: 'review',
  period_start: '2026-08-01',
  period_end: '2026-08-31',
  pay_date: '2026-08-31',
  employee_count: 34,
  gross_total: 500000,
  deduction_total: 60000,
  employer_contribution_total: 45000,
  net_total: 440000,
  employer_cost_total: 545000,
};

const mockDashboard = {
  current_run: mockRun,
  employees_included: 34,
  employees_excluded: 2,
  pending_approvals: 1,
  alerts: [
    { key: 'missing_bank', label: 'Missing bank account', count: 3, severity: 'blocking' },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GIVEN the payroll dashboard with a current run', () => {
  beforeEach(() => {
    mockApi.dashboard.get.mockResolvedValue(mockDashboard);
    mockApi.alerts.employees.mockResolvedValue({ data: [], total: 0 });
  });

  it('WHEN the page loads THEN the run number and status chip render', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Run #7')).toBeInTheDocument());
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('WHEN KPIs load THEN included/excluded employee counts render from the API', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Employees Included')).toBeInTheDocument());
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('Employees Excluded')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('WHEN KPIs load THEN gross, net and employer cost render as currency', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('$500,000.00')).toBeInTheDocument());
    expect(screen.getByText('$440,000.00')).toBeInTheDocument();
    expect(screen.getByText('$545,000.00')).toBeInTheDocument();
  });

  it('WHEN the alerts panel renders THEN each alert shows its count', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Missing bank account')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('GIVEN a dashboard alert drill-down', () => {
  beforeEach(() => {
    mockApi.dashboard.get.mockResolvedValue(mockDashboard);
    mockApi.alerts.employees.mockResolvedValue({
      data: [{ person_id: 'p1', person_name: 'Asha Nair', employee_code: 'EMP-9', department_name: 'Engineering' }],
      total: 1,
    });
  });

  it('WHEN "Review employees" is clicked THEN the drawer opens with the affected employees', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Missing bank account')).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Review employees/));
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    expect(mockApi.alerts.employees).toHaveBeenCalledWith('missing_bank');
  });
});

describe('GIVEN no payroll run exists yet', () => {
  beforeEach(() => {
    mockApi.dashboard.get.mockResolvedValue({ current_run: null, alerts: [] });
  });

  it('WHEN the page loads THEN the first-run empty state CTA renders', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Start your first payroll run')).toBeInTheDocument());
  });
});
