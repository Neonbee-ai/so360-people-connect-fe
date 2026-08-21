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

const payslip = {
  id: 'ps1', person_id: 'p1', payslip_number: 'PS-202608-0042',
  period_start: '2026-08-01', period_end: '2026-08-31',
  gross: 50000, total_deductions: 5000, net_pay: 45000,
};

const renderPage = () => render(<MemoryRouter><MyPayslipsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.my.payslips.mockResolvedValue({ data: [payslip], total: 1 });
});

describe('GIVEN the payslip row label with bad input', () => {
  it('WHEN the period start is unparseable THEN a generic label is used', () => {
    expect(payslipRowLabel('not-a-date')).toBe('Your payslip');
  });
});

describe('GIVEN self-service payslip failure paths', () => {
  it('WHEN the payslip list fails THEN the page degrades to the empty state', async () => {
    mockApi.my.payslips.mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() => expect(screen.getByText('No payslips yet')).toBeInTheDocument());
  });

  it('WHEN the payslip detail fails THEN no modal opens', async () => {
    mockApi.my.payslip.mockRejectedValue(new Error('nope'));
    renderPage();
    await waitFor(() => expect(screen.getByText('View')).toBeInTheDocument());
    fireEvent.click(screen.getByText('View'));
    await waitFor(() => expect(mockApi.my.payslip).toHaveBeenCalledWith('ps1'));
    expect(screen.queryByText('Payslip PS-202608-0042')).not.toBeInTheDocument();
  });

  it('WHEN the view modal is dismissed THEN it closes', async () => {
    mockApi.my.payslip.mockResolvedValue({ ...payslip, lines: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('View')).toBeInTheDocument());
    fireEvent.click(screen.getByText('View'));
    await waitFor(() => expect(screen.getByText('Payslip PS-202608-0042')).toBeInTheDocument());
    fireEvent.click(document.querySelector('div.fixed.inset-0.bg-black\\/60') as Element);
    await waitFor(() => expect(screen.queryByText('Payslip PS-202608-0042')).not.toBeInTheDocument());
  });

  it('WHEN the PDF download fails THEN the page survives', async () => {
    mockApi.my.downloadPayslipPdf.mockRejectedValue(new Error('nope'));
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Download PS-202608-0042')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Download PS-202608-0042'));
    await waitFor(() => expect(mockApi.my.downloadPayslipPdf).toHaveBeenCalled());
    expect(screen.getByText(/PS-202608-0042/)).toBeInTheDocument();
  });
});
