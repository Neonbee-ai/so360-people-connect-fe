import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: {
    runs: { list: vi.fn(), create: vi.fn() },
    periods: { list: vi.fn() },
  },
}));

import PayrollRunsPage from './PayrollRunsPage';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;

const mockRun = {
  id: 'run-1',
  run_number: 5,
  status: 'review',
  period_start: '2026-08-01',
  period_end: '2026-08-31',
  pay_date: '2026-08-31',
  payroll_group_name: 'Monthly Staff',
  employee_count: 12,
  net_total: 240000,
};

const mockPeriod = {
  id: 'per-1', payroll_group_id: 'g1',
  period_start: '2026-09-01', period_end: '2026-09-30',
  pay_date: '2026-09-30', status: 'open',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/people/payroll/runs']}>
      <Routes>
        <Route path="/people/payroll/runs" element={<PayrollRunsPage />} />
        <Route path="/people/payroll/runs/:id" element={<div>Run detail page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.periods.list.mockResolvedValue({ data: [mockPeriod], total: 1 });
});


describe('GIVEN the Comb payroll runs list', () => {
  beforeEach(() => {
    mockApi.runs.list.mockResolvedValue({ data: [mockRun], total: 1 });
    mockApi.runs.create.mockResolvedValue({ ...mockRun, id: 'run-new', run_number: 6 });
  });

  it('WHEN it loads THEN the page title and New payroll run action render', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /New payroll run/ })).toBeInTheDocument();
  });

  it('WHEN a row is opened THEN it navigates to the run detail', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByText('Run detail page')).toBeInTheDocument());
  });

  it('WHEN New payroll run is clicked and an open period exists THEN a run is created for it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New payroll run/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Run' }));
    await waitFor(() => expect(mockApi.runs.create).toHaveBeenCalledWith({ payroll_period_id: 'per-1' }));
  });

  it('WHEN there are no runs THEN the empty state renders instead of the table', async () => {
    mockApi.runs.list.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.queryByText('#5')).not.toBeInTheDocument());
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
