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

describe('GIVEN the Comb My Payslips page', () => {
  beforeEach(() => {
    mockApi.my.payslips.mockResolvedValue({ data: [mockPayslip], total: 1 });
  });

  it('WHEN rendered THEN each payslip is a card with its month label', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Your August 2026 payslip')).toBeInTheDocument());
  });

  it('WHEN the payslip card is clicked THEN the detail dialog opens', async () => {
    mockApi.my.payslip.mockResolvedValue({
      ...mockPayslip,
      lines: [{ id: 'l1', run_employee_id: 're1', component_code: 'BASIC', component_name: 'Basic Salary', kind: 'earning', amount: 50000 }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Your August 2026 payslip')).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Your .* payslip/));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('WHEN Download is clicked THEN the self-service PDF is requested', async () => {
    mockApi.my.downloadPayslipPdf.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText('Your August 2026 payslip')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Download PS-202608-0042'));
    await waitFor(() => expect(mockApi.my.downloadPayslipPdf).toHaveBeenCalledWith('ps1', 'PS-202608-0042.pdf'));
  });

  it('WHEN there are no payslips THEN the empty state renders', async () => {
    mockApi.my.payslips.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No payslips yet')).toBeInTheDocument());
  });
});
