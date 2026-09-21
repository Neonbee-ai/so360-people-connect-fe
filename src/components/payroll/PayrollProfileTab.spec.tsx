import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: {
    employees: {
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      salary: { list: vi.fn(), revise: vi.fn() },
      overrides: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
      benefits: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
      bankAccounts: { list: vi.fn(), create: vi.fn(), reveal: vi.fn() },
      history: vi.fn(),
    },
    components: { list: vi.fn() },
    benefitTypes: { list: vi.fn() },
    structures: { list: vi.fn() },
    statutory: { get: vi.fn() },
  },
}));

import PayrollProfileTab from './PayrollProfileTab';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;

const person = {
  id: 'p1',
  full_name: 'Asha Nair',
  type: 'employee',
  job_title: 'Engineer',
  department_info: { name: 'Engineering' },
  start_date: '2024-01-15',
  status: 'active',
};

const FULL_ACCOUNT_NUMBER = '123456789012';

const mockAssignment = {
  id: 'a1', person_id: 'p1', structure_id: 's1', structure_version: 1,
  structure_name: 'Standard India', monthly_wage: 50000, annual_ctc: 600000,
  effective_from: '2026-01-01', effective_to: null, revision_type: 'initial',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.employees.getProfile.mockResolvedValue({
    person_id: 'p1', wage_type: 'salaried', is_payroll_enabled: true, tax_regime: 'new',
    contract: { type: 'permanent', start: '2024-01-15' },
    statutory_identifiers: { pan: 'ABCDE1234F' },
  });
  mockApi.employees.salary.list.mockResolvedValue({ data: [mockAssignment], total: 1 });
  mockApi.employees.overrides.list.mockResolvedValue({ data: [], total: 0 });
  mockApi.employees.benefits.list.mockResolvedValue({ data: [], total: 0 });
  mockApi.employees.history.mockResolvedValue({ data: [], total: 0 });
  mockApi.employees.bankAccounts.list.mockResolvedValue({
    data: [{
      id: 'b1', person_id: 'p1', bank_name: 'HDFC Bank', account_holder: 'Asha Nair',
      account_number_last4: '9012', ifsc: 'HDFC0001234', account_type: 'savings',
      payment_method: 'bank_transfer', is_primary: true,
    }],
    total: 1,
  });
  mockApi.components.list.mockResolvedValue({ data: [], total: 0 });
  mockApi.benefitTypes.list.mockResolvedValue({ data: [], total: 0 });
  mockApi.structures.list.mockResolvedValue({ data: [{ id: 's1', name: 'Standard India', code: 'STD', status: 'active', version: 1 }], total: 1 });
  mockApi.statutory.get.mockResolvedValue({
    pack: 'india', enabled: true,
    config: { identifiers: [{ key: 'pan', label: 'PAN', required_for_payroll: true }, { key: 'uan', label: 'UAN', required_for_payroll: false }] },
  });
});

const renderTab = () => render(<MemoryRouter><PayrollProfileTab person={person} /></MemoryRouter>);

describe('GIVEN the Payroll tab for a person', () => {
  it('WHEN it loads THEN all progressive-disclosure sections render', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText('Employment & Contract')).toBeInTheDocument());
    for (const section of ['Salary', 'Components & Overrides', 'Benefits', 'Tax & Statutory', 'Bank', 'Documents', 'History']) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
  });

  it('WHEN the Employment section is open THEN master data from People Registry is shown read-only', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText('Employment & Contract')).toBeInTheDocument());
    expect(screen.getByText('Asha Nair')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText(/edited there — never duplicated in payroll/)).toBeInTheDocument();
  });
});

describe('GIVEN the Bank section', () => {
  it('WHEN accounts are listed THEN only masked numbers render and the full number never appears', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText('Bank')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Bank'));
    await waitFor(() => expect(screen.getByText('HDFC Bank')).toBeInTheDocument());
    expect(screen.getByText(/•••• 9012/)).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    // The full account number must never be rendered from a list response.
    expect(document.body.textContent).not.toContain(FULL_ACCOUNT_NUMBER);
  });

  it('WHEN the viewer lacks the reveal permission THEN no Reveal action is offered', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    await waitFor(() => expect(screen.getByText('HDFC Bank')).toBeInTheDocument());
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument();
  });
});

describe('GIVEN the Salary section', () => {
  it('WHEN opened THEN the current assignment card shows the monthly wage', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Salary'));
    await waitFor(() => expect(screen.getByText('$50,000.00')).toBeInTheDocument());
    expect(screen.getByText(/Standard India v1/)).toBeInTheDocument();
  });

  it('WHEN a Salary Adjustment is opened and a new wage typed THEN the previous → new preview updates', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Salary'));
    await waitFor(() => expect(screen.getByText('Salary Adjustment')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Salary Adjustment'));
    await waitFor(() => expect(screen.getByText('Previous')).toBeInTheDocument());
    // Previous shows the current wage
    expect(screen.getAllByText('$50,000.00').length).toBeGreaterThan(0);
    const wageInput = screen.getByLabelText('New Monthly Wage');
    fireEvent.change(wageInput, { target: { value: '60000' } });
    await waitFor(() => expect(screen.getByText('$60,000.00')).toBeInTheDocument());
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});

describe('GIVEN the Tax & Statutory section', () => {
  it('WHEN opened THEN identifier fields come from the statutory config with required hints', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Tax & Statutory'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'PAN' })).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'UAN' })).toBeInTheDocument();
    expect((screen.getByRole('textbox', { name: 'PAN' }) as HTMLInputElement).value).toBe('ABCDE1234F');
    // UAN empty but not required — no blocking message for it
    expect(screen.queryByText(/UAN is required before this employee/)).not.toBeInTheDocument();
  });
});
