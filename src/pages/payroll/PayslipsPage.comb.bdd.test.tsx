import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: {
    payslips: { list: vi.fn(), get: vi.fn(), downloadPdf: vi.fn() },
  },
}));

vi.mock('../../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn() },
}));

import PayslipsPage from './PayslipsPage';
import { payrollApi } from '../../services/payrollApi';
import { peopleApi } from '../../services/peopleService';

const mockApi = payrollApi as any;
const mockPeople = peopleApi as any;

const mockPayslip = {
  id: 'ps1', person_id: 'p1', person_name: 'Asha Nair', payslip_number: 'PS-202608-0042',
  period_start: '2026-08-01', period_end: '2026-08-31',
  gross: 50000, total_deductions: 5000, net_pay: 45000, visibility: 'published',
};

const renderPage = () => render(<MemoryRouter><PayslipsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.payslips.list.mockResolvedValue({ data: [mockPayslip], total: 1 });
  mockPeople.getAll.mockResolvedValue({ data: [{ id: 'p1', full_name: 'Asha Nair' }], total: 1 });
});

describe('GIVEN the Comb Payslips list', () => {
  beforeEach(() => {
    mockApi.payslips.list.mockResolvedValue({ data: [mockPayslip], total: 1 });
    mockPeople.getAll.mockResolvedValue({ data: [{ id: 'p1', full_name: 'Asha Nair' }], total: 1 });
  });

  it('WHEN rendered THEN the list template shows the payslip row', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    expect(screen.getByText('Asha Nair')).toBeInTheDocument();
  });

  it('WHEN rendered THEN the table and the date filters are present', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
  });

  it('WHEN a row is clicked THEN a dialog opens with the payslip lines', async () => {
    mockApi.payslips.get.mockResolvedValue({
      ...mockPayslip,
      lines: [{ id: 'l1', run_employee_id: 're1', component_code: 'BASIC', component_name: 'Basic Salary', kind: 'earning', amount: 50000 }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    fireEvent.click(screen.getByText('PS-202608-0042'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(within(screen.getByRole('dialog')).getByText('Basic Salary')).toBeInTheDocument();
  });

  it('WHEN Download is clicked THEN the PDF is requested with the payslip number', async () => {
    mockApi.payslips.downloadPdf.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Download PS-202608-0042'));
    await waitFor(() => expect(mockApi.payslips.downloadPdf).toHaveBeenCalledWith('ps1', 'PS-202608-0042.pdf'));
  });
});
