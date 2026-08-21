import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('GIVEN the admin payslips page', () => {
  it('WHEN the page loads THEN payslip rows show number, employee, period, net pay and visibility', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    expect(screen.getByText('Asha Nair')).toBeInTheDocument();
    expect(screen.getByText('$45,000.00')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(mockPeople.getAll).toHaveBeenCalledWith({ status: 'active', limit: 200 });
  });

  it('WHEN a payslip has no person name THEN the row shows a dash', async () => {
    mockApi.payslips.list.mockResolvedValue({ data: [{ ...mockPayslip, person_name: undefined, visibility: undefined }], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
    // Missing visibility falls back to published
    expect(screen.getByText('Published')).toBeInTheDocument();
  });

  it('WHEN date filters change THEN the list reloads with from/to', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    const [fromInput, toInput] = Array.from(document.querySelectorAll('input[type="date"]'));
    fireEvent.change(fromInput, { target: { value: '2026-08-01' } });
    await waitFor(() =>
      expect(mockApi.payslips.list).toHaveBeenCalledWith({ person_id: undefined, from: '2026-08-01', to: undefined }));
    fireEvent.change(toInput, { target: { value: '2026-08-31' } });
    await waitFor(() =>
      expect(mockApi.payslips.list).toHaveBeenCalledWith({ person_id: undefined, from: '2026-08-01', to: '2026-08-31' }));
  });

  it('WHEN an employee is picked in the person filter THEN the list reloads scoped to that person', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    const pickerInput = screen.getByPlaceholderText('All employees');
    fireEvent.focus(pickerInput);
    // The dropdown option is a button; the table cell is not.
    const option = await screen.findByRole('button', { name: /Asha Nair/ });
    fireEvent.click(option);
    await waitFor(() =>
      expect(mockApi.payslips.list).toHaveBeenCalledWith({ person_id: 'p1', from: undefined, to: undefined }));
  });

  it('WHEN the people lookup fails THEN the page still renders and filters degrade', async () => {
    mockPeople.getAll.mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
  });

  it('WHEN View is clicked THEN the full payslip is fetched and its lines render in the modal', async () => {
    mockApi.payslips.get.mockResolvedValue({
      ...mockPayslip,
      lines: [{ id: 'l1', run_employee_id: 're1', component_code: 'BASIC', component_name: 'Basic Salary', kind: 'earning', amount: 50000 }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    fireEvent.click(screen.getByText('View'));
    await waitFor(() => expect(screen.getByText('Basic Salary')).toBeInTheDocument());
    expect(mockApi.payslips.get).toHaveBeenCalledWith('ps1');
    expect(screen.getByText('Payslip PS-202608-0042')).toBeInTheDocument();
    expect(screen.getByText('Gross')).toBeInTheDocument();
    // "Net Pay" appears both as the table header and in the modal summary
    expect(screen.getAllByText('Net Pay').length).toBeGreaterThan(1);
    // Closing the modal via its backdrop clears the viewed payslip
    fireEvent.click(document.querySelector('div.fixed.inset-0.bg-black\\/60') as Element);
    await waitFor(() => expect(screen.queryByText('Payslip PS-202608-0042')).not.toBeInTheDocument());
  });

  it('WHEN loading the payslip detail fails THEN no modal opens', async () => {
    mockApi.payslips.get.mockRejectedValue(new Error('nope'));
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    fireEvent.click(screen.getByText('View'));
    await waitFor(() => expect(mockApi.payslips.get).toHaveBeenCalled());
    expect(screen.queryByText('Payslip PS-202608-0042')).not.toBeInTheDocument();
  });

  it('WHEN the download action is clicked THEN the PDF download uses the payslip number as filename', async () => {
    mockApi.payslips.downloadPdf.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Download PS-202608-0042'));
    await waitFor(() => expect(mockApi.payslips.downloadPdf).toHaveBeenCalledWith('ps1', 'PS-202608-0042.pdf'));
  });

  it('WHEN the download fails THEN the page survives (toast handles it)', async () => {
    mockApi.payslips.downloadPdf.mockRejectedValue(new Error('nope'));
    renderPage();
    await waitFor(() => expect(screen.getByText('PS-202608-0042')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Download PS-202608-0042'));
    await waitFor(() => expect(mockApi.payslips.downloadPdf).toHaveBeenCalled());
    expect(screen.getByText('PS-202608-0042')).toBeInTheDocument();
  });

  it('WHEN no payslips match THEN the empty state renders', async () => {
    mockApi.payslips.list.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No payslips')).toBeInTheDocument());
  });

  it('WHEN the list API fails THEN the page falls back to the empty state', async () => {
    mockApi.payslips.list.mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() => expect(screen.getByText('No payslips')).toBeInTheDocument());
  });
});
