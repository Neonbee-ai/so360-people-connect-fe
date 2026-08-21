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
    <MemoryRouter initialEntries={['/payroll/runs']}>
      <Routes>
        <Route path="/payroll/runs" element={<PayrollRunsPage />} />
        <Route path="/payroll/runs/:id" element={<div>Run detail page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.periods.list.mockResolvedValue({ data: [mockPeriod], total: 1 });
});

describe('GIVEN the payroll runs list', () => {
  beforeEach(() => {
    mockApi.runs.list.mockResolvedValue({ data: [mockRun], total: 1 });
  });

  it('WHEN the page loads THEN each run row shows number, group, status, employees and net total', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    expect(screen.getByText('Monthly Staff')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('$240,000.00')).toBeInTheDocument();
  });

  it('WHEN a row Open action is clicked THEN it navigates to the run detail page', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => expect(screen.getByText('Run detail page')).toBeInTheDocument());
  });

  it('WHEN a run has no period dates or group THEN dashes render instead', async () => {
    mockApi.runs.list.mockResolvedValue({
      data: [{ ...mockRun, period_start: undefined, period_end: undefined, payroll_group_name: undefined, employee_count: undefined }],
      total: 1,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});

describe('GIVEN the new-run dialog', () => {
  beforeEach(() => {
    mockApi.runs.list.mockResolvedValue({ data: [mockRun], total: 1 });
  });

  it('WHEN opened THEN it lists only open pay periods from the API', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New payroll run'));
    await waitFor(() => expect(screen.getByText('New Payroll Run')).toBeInTheDocument());
    expect(mockApi.periods.list).toHaveBeenCalledWith({ status: 'open' });
    await waitFor(() => expect(screen.getByText('2026-09-01 – 2026-09-30')).toBeInTheDocument());
  });

  it('WHEN a period is selected and Create Run clicked THEN the run is created and the page navigates to it', async () => {
    mockApi.runs.create.mockResolvedValue({ ...mockRun, id: 'run-new', run_number: 6 });
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New payroll run'));
    await waitFor(() => expect(screen.getByText('2026-09-01 – 2026-09-30')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByText('Create Run'));
    await waitFor(() => expect(mockApi.runs.create).toHaveBeenCalledWith({ payroll_period_id: 'per-1' }));
    await waitFor(() => expect(screen.getByText('Run detail page')).toBeInTheDocument());
  });

  it('WHEN no period is selected THEN Create Run is disabled and no API call happens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New payroll run'));
    await waitFor(() => expect(screen.getByText('Create Run')).toBeInTheDocument());
    expect(screen.getByText('Create Run')).toBeDisabled();
    fireEvent.click(screen.getByText('Create Run'));
    expect(mockApi.runs.create).not.toHaveBeenCalled();
  });

  it('WHEN run creation fails THEN the dialog stays open and no navigation happens', async () => {
    mockApi.runs.create.mockRejectedValue(new Error('Period already has a run'));
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New payroll run'));
    await waitFor(() => expect(screen.getByText('2026-09-01 – 2026-09-30')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByText('Create Run'));
    await waitFor(() => expect(mockApi.runs.create).toHaveBeenCalled());
    expect(screen.getByText('New Payroll Run')).toBeInTheDocument();
    expect(screen.queryByText('Run detail page')).not.toBeInTheDocument();
  });

  it('WHEN Cancel is clicked THEN the dialog closes without creating anything', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New payroll run'));
    await waitFor(() => expect(screen.getByText('New Payroll Run')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('New Payroll Run')).not.toBeInTheDocument());
    expect(mockApi.runs.create).not.toHaveBeenCalled();
  });

  it('WHEN there are no open periods THEN the dialog explains how to generate them', async () => {
    mockApi.periods.list.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New payroll run'));
    await waitFor(() => expect(screen.getByText(/No open pay periods/)).toBeInTheDocument());
  });

  it('WHEN loading open periods fails THEN the dialog still renders (toast handles the error)', async () => {
    mockApi.periods.list.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('#5')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New payroll run'));
    await waitFor(() => expect(screen.getByText('New Payroll Run')).toBeInTheDocument());
  });
});

describe('GIVEN no payroll runs exist', () => {
  it('WHEN the page loads THEN the empty state offers starting the first run', async () => {
    mockApi.runs.list.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No payroll runs yet')).toBeInTheDocument());
    // The empty-state CTA also opens the new-run dialog
    fireEvent.click(screen.getAllByText('New payroll run')[1]);
    await waitFor(() => expect(screen.getByText('New Payroll Run')).toBeInTheDocument());
  });
});

describe('GIVEN the runs API fails', () => {
  it('WHEN the page loads THEN it falls back to the empty state without crashing', async () => {
    mockApi.runs.list.mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() => expect(screen.getByText('No payroll runs yet')).toBeInTheDocument());
  });
});
