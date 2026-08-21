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

describe('GIVEN the payroll reports page', () => {
  it('WHEN the page loads THEN all eight report cards render and no report is selected yet', async () => {
    render(<PayrollReportsPage />);
    for (const label of ['Payroll Summary', 'Salary Register', 'Department Cost', 'Employer Contributions', 'Deductions', 'Component Report', 'Variance', 'Payroll History']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Pick a report')).toBeInTheDocument();
    await waitFor(() => expect(mockApi.groups.list).toHaveBeenCalled());
    expect(mockDepartments.getAll).toHaveBeenCalledWith({ limit: 200 });
  });

  it('WHEN filter option loads fail THEN the page still renders (filters degrade)', async () => {
    mockApi.groups.list.mockRejectedValue(new Error('down'));
    mockDepartments.getAll.mockRejectedValue(new Error('down'));
    render(<PayrollReportsPage />);
    await waitFor(() => expect(mockApi.groups.list).toHaveBeenCalled());
    expect(screen.getByText('Pick a report')).toBeInTheDocument();
  });

  it('WHEN a report card is clicked THEN the report runs and the table renders rows and totals', async () => {
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Payroll Summary'));
    await waitFor(() => expect(mockApi.reports.run).toHaveBeenCalledWith('summary', {
      from: undefined, to: undefined, group_id: undefined, department_id: undefined,
    }));
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    expect(screen.getByText('240000')).toBeInTheDocument();
    // null cell renders a dash
    expect(screen.getByText('—')).toBeInTheDocument();
    // totals footer
    expect(screen.getByText('480000')).toBeInTheDocument();
  });

  it('WHEN filters are set and Apply Filters clicked THEN the run carries the filters', async () => {
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Salary Register'));
    await waitFor(() => expect(screen.getByText('Apply Filters')).toBeInTheDocument());
    const [fromInput, toInput] = Array.from(document.querySelectorAll('input[type="date"]'));
    fireEvent.change(fromInput, { target: { value: '2026-08-01' } });
    fireEvent.change(toInput, { target: { value: '2026-08-31' } });
    const [groupSelect, deptSelect] = screen.getAllByRole('combobox');
    await waitFor(() => expect(screen.getByText('Monthly Staff')).toBeInTheDocument());
    fireEvent.change(groupSelect, { target: { value: 'g1' } });
    fireEvent.change(deptSelect, { target: { value: 'dep1' } });
    fireEvent.click(screen.getByText('Apply Filters'));
    await waitFor(() => expect(mockApi.reports.run).toHaveBeenLastCalledWith('salary-register', {
      from: '2026-08-01', to: '2026-08-31', group_id: 'g1', department_id: 'dep1',
    }));
  });

  it('WHEN Export CSV is clicked THEN the export uses the same filters', async () => {
    mockApi.reports.exportCsv.mockResolvedValue(undefined);
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Department Cost'));
    await waitFor(() => expect(screen.getByText('Export CSV')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Export CSV'));
    await waitFor(() => expect(mockApi.reports.exportCsv).toHaveBeenCalledWith('department-cost', {
      from: undefined, to: undefined, group_id: undefined, department_id: undefined,
    }));
  });

  it('WHEN the export fails THEN the button returns to its idle label', async () => {
    mockApi.reports.exportCsv.mockRejectedValue(new Error('nope'));
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Variance'));
    await waitFor(() => expect(screen.getByText('Export CSV')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Export CSV'));
    await waitFor(() => expect(mockApi.reports.exportCsv).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Export CSV')).toBeInTheDocument());
  });

  it('WHEN a report returns no rows THEN the no-data empty state renders', async () => {
    mockApi.reports.run.mockResolvedValue({ columns: [], rows: [] });
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Deductions'));
    await waitFor(() => expect(screen.getByText('No data')).toBeInTheDocument());
  });

  it('WHEN a report run fails THEN the result clears to the no-data state', async () => {
    mockApi.reports.run.mockRejectedValue(new Error('boom'));
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Payroll History'));
    await waitFor(() => expect(screen.getByText('No data')).toBeInTheDocument());
  });

  it('WHEN a report has no totals THEN no footer renders', async () => {
    mockApi.reports.run.mockResolvedValue({ ...reportResult, totals: undefined });
    render(<PayrollReportsPage />);
    fireEvent.click(screen.getByText('Payroll Summary'));
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    expect(document.querySelector('tfoot')).toBeNull();
  });
});
