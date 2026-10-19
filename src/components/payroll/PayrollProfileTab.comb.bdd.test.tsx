import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const shellState = { permissionsLoaded: true, permissions: [] as string[] };

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    permissionsLoaded: shellState.permissionsLoaded,
    hasPermission: (code: string) => shellState.permissions.includes(code),
  }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

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

import { toast } from '@so360/design-system';
import PayrollProfileTab from './PayrollProfileTab';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;

const person = {
  id: 'p1', full_name: 'Asha Nair', type: 'employee', job_title: 'Engineer',
  department_info: { name: 'Engineering' }, start_date: '2024-01-15', status: 'active',
};

beforeEach(() => {
  vi.resetAllMocks();
  shellState.permissionsLoaded = true;
  shellState.permissions = [];
  vi.spyOn(toast, 'success').mockImplementation(() => undefined as never);
  vi.spyOn(toast, 'error').mockImplementation(() => undefined as never);
  mockApi.employees.getProfile.mockResolvedValue({
    person_id: 'p1', wage_type: 'salaried', is_payroll_enabled: true, tax_regime: 'new',
    contract: { type: 'permanent', start: '2024-01-15' },
    statutory_identifiers: { pan: 'ABCDE1234F' },
  });
  mockApi.employees.updateProfile.mockResolvedValue({});
  mockApi.employees.salary.list.mockResolvedValue({ data: [], total: 0 });
  mockApi.employees.overrides.list.mockResolvedValue({
    data: [{ id: 'o1', component_code: 'BONUS', action: 'add', recurrence: 'one_time', effective_from: '2026-01-01' }],
    total: 1,
  });
  mockApi.employees.overrides.remove.mockResolvedValue({});
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
  mockApi.employees.bankAccounts.create.mockResolvedValue({});
  mockApi.components.list.mockResolvedValue({ data: [], total: 0 });
  mockApi.benefitTypes.list.mockResolvedValue({ data: [], total: 0 });
  mockApi.structures.list.mockResolvedValue({ data: [], total: 0 });
  mockApi.statutory.get.mockResolvedValue({
    pack: 'india', enabled: true,
    config: { identifiers: [{ key: 'pan', label: 'PAN', required_for_payroll: true }] },
  });
});

const renderTab = () => render(<MemoryRouter><PayrollProfileTab person={person} /></MemoryRouter>);

describe('GIVEN the Comb-converted Payroll profile tab', () => {
  it('WHEN a section header is clicked THEN aria-expanded toggles and only one section stays open', async () => {
    renderTab();
    const employment = (await screen.findByText('Employment & Contract')).closest('button')!;
    const bank = screen.getByText('Bank').closest('button')!;
    expect(employment).toHaveAttribute('aria-expanded', 'true');
    expect(bank).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(bank);
    expect(bank).toHaveAttribute('aria-expanded', 'true');
    expect(employment).toHaveAttribute('aria-expanded', 'false');
  });

  it('WHEN Save Contract is clicked THEN the profile is updated and a success toast shows', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Save Contract'));
    await waitFor(() => expect(mockApi.employees.updateProfile).toHaveBeenCalledWith(
      'p1', { contract: { type: 'permanent', start: '2024-01-15' } },
    ));
    expect(toast.success).toHaveBeenCalledWith('Contract details saved');
  });

  it('WHEN the profile update fails THEN an error toast shows', async () => {
    mockApi.employees.updateProfile.mockRejectedValue(new Error('boom'));
    renderTab();
    fireEvent.click(await screen.findByText('Save Contract'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save contract details'));
  });

  it('WHEN no salary is assigned THEN the warning alert is shown in the Salary section', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Salary'));
    expect(await screen.findByText(/No salary assigned yet/)).toBeInTheDocument();
    expect(screen.getByText('Salary Adjustment')).toBeInTheDocument();
  });

  it('WHEN the Remove override icon button is clicked THEN the override is removed', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    fireEvent.click(await screen.findByLabelText('Remove override'));
    await waitFor(() => expect(mockApi.employees.overrides.remove).toHaveBeenCalledWith('p1', 'o1'));
    expect(toast.success).toHaveBeenCalledWith('Override removed');
  });

  it('WHEN the tax regime is switched and saved THEN updateProfile receives the new regime and identifiers', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Tax & Statutory'));
    fireEvent.click(await screen.findByText('Old Regime'));
    fireEvent.click(screen.getByText('Save Tax & Statutory'));
    await waitFor(() => expect(mockApi.employees.updateProfile).toHaveBeenCalledWith(
      'p1', { statutory_identifiers: { pan: 'ABCDE1234F' }, tax_regime: 'old' },
    ));
  });

  it('WHEN the viewer lacks payroll.bank_reveal THEN the masked number shows and no Reveal button is offered', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    expect(await screen.findByText('HDFC Bank')).toBeInTheDocument();
    expect(screen.getByText(/•••• 9012/)).toBeInTheDocument();
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument();
  });

  it('WHEN the viewer has payroll.bank_reveal THEN a Reveal button is offered', async () => {
    shellState.permissions = ['payroll.bank_reveal'];
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    expect(await screen.findByText('Reveal')).toBeInTheDocument();
  });
});
