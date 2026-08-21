import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: {
    my: {
      payslips: vi.fn(),
      payslip: vi.fn(),
      downloadPayslipPdf: vi.fn(),
    },
  },
}));

import MyPayslipsPage, { payslipRowLabel } from './MyPayslipsPage';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;

const mockPayslip = {
  id: 'ps1', person_id: 'p1', payslip_number: 'PS-202608-0042',
  period_start: '2026-08-01', period_end: '2026-08-31',
  gross: 50000, total_deductions: 5000, net_pay: 45000,
};

const renderPage = () => render(<MemoryRouter><MyPayslipsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GIVEN the payslip row label helper', () => {
  it('WHEN given a period start THEN it produces a "Your <Month> <Year> payslip" label', () => {
    expect(payslipRowLabel('2026-08-01')).toBe('Your August 2026 payslip');
  });
});

describe('GIVEN My Payslips with existing payslips', () => {
  beforeEach(() => {
    mockApi.my.payslips.mockResolvedValue({ data: [mockPayslip], total: 1 });
  });

  it('WHEN the page loads THEN my payslips are listed with human month labels', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Your August 2026 payslip')).toBeInTheDocument());
    expect(screen.getByText(/PS-202608-0042/)).toBeInTheDocument();
    expect(mockApi.my.payslips).toHaveBeenCalled();
  });

  it('WHEN View is clicked THEN the payslip detail is fetched from the self-service endpoint', async () => {
    mockApi.my.payslip.mockResolvedValue({
      ...mockPayslip,
      lines: [{ id: 'l1', run_employee_id: 're1', component_code: 'BASIC', component_name: 'Basic Salary', kind: 'earning', amount: 50000 }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Your August 2026 payslip')).toBeInTheDocument());
    fireEvent.click(screen.getByText('View'));
    await waitFor(() => expect(screen.getByText('Basic Salary')).toBeInTheDocument());
    expect(mockApi.my.payslip).toHaveBeenCalledWith('ps1');
  });

  it('WHEN the download action is clicked THEN the self-service PDF download is invoked', async () => {
    mockApi.my.downloadPayslipPdf.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText('Your August 2026 payslip')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Download PS-202608-0042'));
    await waitFor(() => expect(mockApi.my.downloadPayslipPdf).toHaveBeenCalledWith('ps1', 'PS-202608-0042.pdf'));
  });
});

describe('GIVEN My Payslips with no payslips yet', () => {
  beforeEach(() => {
    mockApi.my.payslips.mockResolvedValue({ data: [], total: 0 });
  });

  it('WHEN the page loads THEN a friendly empty state renders', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No payslips yet')).toBeInTheDocument());
  });
});
