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


describe('GIVEN the Comb payroll dashboard', () => {
  it('WHEN a current run exists THEN its run label and alerts render', async () => {
    mockApi.dashboard.get.mockResolvedValue(mockDashboard);
    renderPage();
    await waitFor(() => expect(screen.getByText(/Run #7/)).toBeInTheDocument());
    expect(screen.getByText('Missing bank account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Current Run/ })).toBeInTheDocument();
  });

  it('WHEN there is no run THEN the start-your-first-run empty state renders', async () => {
    mockApi.dashboard.get.mockResolvedValue({ current_run: null, alerts: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Start your first payroll run')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Open Current Run/ })).not.toBeInTheDocument();
  });

  it('WHEN Review employees is clicked THEN the alert drawer loads affected employees', async () => {
    mockApi.dashboard.get.mockResolvedValue(mockDashboard);
    mockApi.alerts.employees.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('Missing bank account')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Review employees/ }));
    await waitFor(() => expect(mockApi.alerts.employees).toHaveBeenCalledWith('missing_bank'));
  });

  it('WHEN there are no alerts THEN the all-clear text shows', async () => {
    mockApi.dashboard.get.mockResolvedValue({ ...mockDashboard, alerts: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/everyone is payroll-ready/)).toBeInTheDocument());
  });
});
