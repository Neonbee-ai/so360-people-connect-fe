import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: {
    groups: { list: vi.fn() },
    reports: { run: vi.fn(), exportCsv: vi.fn() },
  },
}));

vi.mock('../../services/departmentsService', () => ({
  departmentsApi: { getAll: vi.fn() },
}));

import PayrollReportsPage from './PayrollReportsPage';
import { payrollApi } from '../../services/payrollApi';
import { departmentsApi } from '../../services/departmentsService';

const mockApi = payrollApi as any;
const mockDepartments = departmentsApi as any;

const reportResult = {
  columns: [
    { key: 'run', label: 'Run' },
    { key: 'net', label: 'Net Total' },
  ],
  rows: [
    { run: '#5', net: 240000 },
    { run: '#6', net: null },
  ],
  totals: { net: 480000 },
};

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.groups.list.mockResolvedValue({ data: [{ id: 'g1', name: 'Monthly Staff', code: 'MONTHLY', is_default: true, is_active: true }], total: 1 });
  mockDepartments.getAll.mockResolvedValue({ data: [{ id: 'dep1', name: 'Engineering' }], total: 1 });
  mockApi.reports.run.mockResolvedValue(reportResult);
});

describe('GIVEN the Comb Payroll Reports page', () => {
  it('WHEN rendered THEN the report picker buttons and filter actions show', async () => {
    render(<PayrollReportsPage />);
    expect(screen.getByText('Payroll Summary')).toBeInTheDocument();
    expect(screen.getByText('Apply Filters')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('WHEN a report is chosen THEN the data table renders its rows', async () => {
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Payroll Summary'));
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    expect(screen.getByText('#6')).toBeInTheDocument();
  });

  it('WHEN a report has totals THEN a totals row shows the aggregate', async () => {
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Payroll Summary'));
    await waitFor(() => expect(screen.getByText('480000')).toBeInTheDocument());
  });

  it('WHEN the report API rejects THEN the page stays rendered', async () => {
    mockApi.reports.run.mockRejectedValue(new Error('boom'));
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Payroll Summary'));
    await waitFor(() => expect(mockApi.reports.run).toHaveBeenCalled());
    expect(screen.getByText('Apply Filters')).toBeInTheDocument();
  });
});
