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

// This spec exercises the reveal-permitted paths too, so the shell bridge is
// controllable per test (the sibling spec keeps the default no-permission stub).
const shellBridgeState: { permissionsLoaded: boolean; permissions: string[] } = {
  permissionsLoaded: true,
  permissions: [],
};
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    permissionsLoaded: shellBridgeState.permissionsLoaded,
    hasPermission: (code: string) => shellBridgeState.permissions.includes(code),
  }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

import PayrollProfileTab from './PayrollProfileTab';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;

const person = {
  id: 'p1', full_name: 'Asha Nair', type: 'employee', job_title: 'Engineer',
  department_info: { name: 'Engineering' }, start_date: '2024-01-15', status: 'active',
};

const assignment = {
  id: 'a1', person_id: 'p1', structure_id: 's1', structure_version: 1,
  structure_name: 'Standard India', monthly_wage: 50000, annual_ctc: 600000,
  effective_from: '2026-01-01', effective_to: null, revision_type: 'initial', revision_reason: 'Joining',
};

const override = {
  id: 'ov1', person_id: 'p1', component_id: 'c9', component_code: 'LOAN_EMI',
  action: 'add', calc_override: { amount: 2500 }, effective_from: '2026-02-01',
  effective_to: null, recurrence: 'recurring', reason: 'Laptop loan',
};

const benefit = {
  id: 'eb1', person_id: 'p1', benefit_type_id: 'bt1', benefit_type_name: 'Health Insurance',
  amount_override: 1800, effective_from: '2026-01-01', recurrence: 'recurring',
};

beforeEach(() => {
  vi.resetAllMocks();
  shellBridgeState.permissionsLoaded = true;
  shellBridgeState.permissions = [];
  mockApi.employees.getProfile.mockResolvedValue({
    person_id: 'p1', wage_type: 'salaried', is_payroll_enabled: true, tax_regime: 'new',
    contract: { type: 'permanent', start: '2024-01-15' },
    statutory_identifiers: { pan: 'ABCDE1234F' },
  });
  mockApi.employees.updateProfile.mockResolvedValue({});
  mockApi.employees.salary.list.mockResolvedValue({ data: [assignment], total: 1 });
  mockApi.employees.overrides.list.mockResolvedValue({ data: [override], total: 1 });
  mockApi.employees.benefits.list.mockResolvedValue({ data: [benefit], total: 1 });
  mockApi.employees.history.mockResolvedValue({ data: [], total: 0 });
  mockApi.employees.bankAccounts.list.mockResolvedValue({
    data: [{
      id: 'b1', person_id: 'p1', bank_name: 'HDFC Bank', account_holder: 'Asha Nair',
      account_number_last4: '9012', ifsc: 'HDFC0001234', account_type: 'savings',
      payment_method: 'bank_transfer', is_primary: true,
    }],
    total: 1,
  });
  mockApi.components.list.mockResolvedValue({
    data: [{ id: 'c9', code: 'LOAN_EMI', name: 'Loan EMI', kind: 'deduction', calc_type: 'fixed', calc_config: {}, frequency: 'per_period', taxable: false, is_statutory: false, prorate_on_lop: false, is_active: true }],
    total: 1,
  });
  mockApi.benefitTypes.list.mockResolvedValue({
    data: [{ id: 'bt1', name: 'Health Insurance', taxable: false, payer: 'employer', frequency: 'per_period', is_active: true }],
    total: 1,
  });
  mockApi.structures.list.mockResolvedValue({ data: [{ id: 's1', name: 'Standard India', code: 'STD', status: 'active', version: 1 }], total: 1 });
  mockApi.statutory.get.mockResolvedValue({
    pack: 'india', enabled: true,
    config: {
      identifiers: [
        { key: 'pan', label: 'PAN', required_for_payroll: true },
        { key: 'aadhaar', label: 'Aadhaar', required_for_payroll: false, masked: true },
      ],
    },
  });
});

const renderTab = () => render(<MemoryRouter><PayrollProfileTab person={person} /></MemoryRouter>);

// =============================================================================
// Employment & contract
// =============================================================================

describe('GIVEN the Employment & Contract section', () => {
  it('WHEN the contract type switches to fixed term THEN the end-date field appears and the contract saves', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText('Employment & Contract')).toBeInTheDocument());
    expect(screen.queryByText('Contract End')).not.toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Permanent'), { target: { value: 'fixed_term' } });
    await waitFor(() => expect(screen.getByText('Contract End')).toBeInTheDocument());
    const dateInputs = Array.from(document.querySelectorAll('input[type="date"]'));
    fireEvent.change(dateInputs[dateInputs.length - 1], { target: { value: '2027-01-14' } });
    fireEvent.change(dateInputs[0], { target: { value: '2024-02-01' } });
    fireEvent.click(screen.getByText('Save Contract'));
    await waitFor(() => expect(mockApi.employees.updateProfile).toHaveBeenCalledWith('p1', {
      contract: { type: 'fixed_term', start: '2024-02-01', end: '2027-01-14' },
    }));
  });

  it('WHEN saving the contract fails THEN the section stays editable', async () => {
    mockApi.employees.updateProfile.mockRejectedValue(new Error('nope'));
    renderTab();
    await waitFor(() => expect(screen.getByText('Save Contract')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Contract'));
    await waitFor(() => expect(mockApi.employees.updateProfile).toHaveBeenCalled());
    expect(screen.getByText('Save Contract')).toBeInTheDocument();
  });

  it('WHEN the profile API fails THEN the tab still renders with an empty profile', async () => {
    mockApi.employees.getProfile.mockRejectedValue(new Error('404'));
    renderTab();
    await waitFor(() => expect(screen.getByText('Employment & Contract')).toBeInTheDocument());
  });

  it('WHEN a section header is clicked twice THEN it collapses again', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText('Employment & Contract')).toBeInTheDocument());
    expect(screen.getByText('Save Contract')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Employment & Contract'));
    await waitFor(() => expect(screen.queryByText('Save Contract')).not.toBeInTheDocument());
  });
});

// =============================================================================
// Salary
// =============================================================================

describe('GIVEN the Salary section', () => {
  it('WHEN there is no assignment THEN the missing-salary warning shows and the adjustment defaults to initial', async () => {
    mockApi.employees.salary.list.mockResolvedValue({ data: [], total: 0 });
    mockApi.employees.salary.revise.mockResolvedValue(assignment);
    renderTab();
    fireEvent.click(await screen.findByText('Salary'));
    await waitFor(() => expect(screen.getByText(/No salary assigned yet/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Salary Adjustment'));
    await waitFor(() => expect(screen.getByText('Apply Adjustment')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('New Monthly Wage'), { target: { value: '40000' } });
    const selects = screen.getAllByRole('combobox');
    await waitFor(() => expect(screen.getByText('Standard India (v1)')).toBeInTheDocument());
    fireEvent.change(selects[0], { target: { value: 's1' } });
    const dateInput = document.querySelector('form input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByPlaceholderText('Annual increment 2026'), { target: { value: 'First salary' } });
    fireEvent.click(screen.getByText('Apply Adjustment'));
    await waitFor(() => expect(mockApi.employees.salary.revise).toHaveBeenCalledWith('p1', {
      structure_id: 's1', monthly_wage: 40000, effective_from: '2026-09-01',
      revision_reason: 'First salary', revision_type: 'initial',
    }));
  });

  it('WHEN the revision history renders THEN each assignment shows wage, window and reason', async () => {
    mockApi.employees.salary.list.mockResolvedValue({
      data: [
        assignment,
        { ...assignment, id: 'a0', monthly_wage: 45000, effective_from: '2025-01-01', effective_to: '2025-12-31', revision_type: 'increment', revision_reason: 'Annual hike' },
      ],
      total: 2,
    });
    renderTab();
    fireEvent.click(await screen.findByText('Salary'));
    await waitFor(() => expect(screen.getByText('Revision History')).toBeInTheDocument());
    expect(screen.getByText('$45,000.00/month')).toBeInTheDocument();
    expect(screen.getByText(/2025-01-01 → 2025-12-31 · Annual hike/)).toBeInTheDocument();
    expect(screen.getByText(/2026-01-01 → current/)).toBeInTheDocument();
  });

  it('WHEN a revision submit misses required fields THEN nothing is sent', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Salary'));
    fireEvent.click(await screen.findByText('Salary Adjustment'));
    await waitFor(() => expect(screen.getByText('Apply Adjustment')).toBeInTheDocument());
    // No effective_from / reason provided
    fireEvent.click(screen.getByText('Apply Adjustment'));
    expect(mockApi.employees.salary.revise).not.toHaveBeenCalled();
  });

  it('WHEN the revision API fails THEN the modal stays open', async () => {
    mockApi.employees.salary.revise.mockRejectedValue(new Error('overlaps'));
    renderTab();
    fireEvent.click(await screen.findByText('Salary'));
    fireEvent.click(await screen.findByText('Salary Adjustment'));
    await waitFor(() => expect(screen.getByText('Standard India (v1)')).toBeInTheDocument());
    const dateInput = document.querySelector('form input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByPlaceholderText('Annual increment 2026'), { target: { value: 'Hike' } });
    // Change revision type select too (second combobox in the form)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[selects.length - 1], { target: { value: 'decrement' } });
    fireEvent.click(screen.getByText('Apply Adjustment'));
    await waitFor(() => expect(mockApi.employees.salary.revise).toHaveBeenCalledWith('p1', expect.objectContaining({ revision_type: 'decrement' })));
    expect(screen.getByText('Apply Adjustment')).toBeInTheDocument();
  });

  it('WHEN the salary list fails THEN the section shows the no-salary warning', async () => {
    mockApi.employees.salary.list.mockRejectedValue(new Error('down'));
    renderTab();
    fireEvent.click(await screen.findByText('Salary'));
    await waitFor(() => expect(screen.getByText(/No salary assigned yet/)).toBeInTheDocument());
  });
});

// =============================================================================
// Components & Overrides
// =============================================================================

describe('GIVEN the Components & Overrides section', () => {
  it('WHEN it opens THEN existing overrides render with action, amount, window and reason', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    await waitFor(() => expect(screen.getByText(/LOAN_EMI/)).toBeInTheDocument());
    expect(screen.getByText(/add/)).toBeInTheDocument();
    expect(screen.getByText('2500')).toBeInTheDocument();
    expect(screen.getByText(/2026-02-01 → ongoing · Laptop loan/)).toBeInTheDocument();
  });

  it('WHEN a one-time override renders THEN the window shows One time', async () => {
    mockApi.employees.overrides.list.mockResolvedValue({
      data: [{ ...override, recurrence: 'one_time', reason: undefined }], total: 1,
    });
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    await waitFor(() => expect(screen.getByText('One time')).toBeInTheDocument());
  });

  it('WHEN an override is added THEN overrides.create receives the form and the list reloads', async () => {
    mockApi.employees.overrides.create.mockResolvedValue(override);
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    fireEvent.click(await screen.findByText('Add Override'));
    await waitFor(() => expect(screen.getByText('Add Component Override')).toBeInTheDocument());
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'c9' } });
    // Action select → override keeps the amount field visible
    fireEvent.change(selects[1], { target: { value: 'override' } });
    const amount = document.querySelector('form input[type="number"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '3000' } });
    fireEvent.change(selects[2], { target: { value: 'one_time' } });
    const dateInput = document.querySelector('form input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByPlaceholderText('Loan EMI recovery'), { target: { value: 'Advance recovery' } });
    const submitOv = screen.getAllByRole('button', { name: 'Add Override' }).pop() as HTMLElement;
    fireEvent.click(submitOv);
    await waitFor(() => expect(mockApi.employees.overrides.create).toHaveBeenCalledWith('p1', expect.objectContaining({
      component_id: 'c9', action: 'override', recurrence: 'one_time',
      calc_override: { amount: 3000 }, effective_from: '2026-09-01', reason: 'Advance recovery',
    })));
    expect(mockApi.employees.overrides.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('WHEN the action is remove THEN the amount field disappears', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    fireEvent.click(await screen.findByText('Add Override'));
    await waitFor(() => expect(screen.getByText('Add Component Override')).toBeInTheDocument());
    expect(screen.getByText('Amount')).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'remove' } });
    await waitFor(() => expect(screen.queryByText('Amount')).not.toBeInTheDocument());
  });

  it('WHEN required fields are missing THEN the override is not created', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    fireEvent.click(await screen.findByText('Add Override'));
    await waitFor(() => expect(screen.getByText('Add Component Override')).toBeInTheDocument());
    const submitOv = screen.getAllByRole('button', { name: 'Add Override' }).pop() as HTMLElement;
    fireEvent.click(submitOv);
    expect(mockApi.employees.overrides.create).not.toHaveBeenCalled();
  });

  it('WHEN creating the override fails THEN the modal stays open', async () => {
    mockApi.employees.overrides.create.mockRejectedValue(new Error('nope'));
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    fireEvent.click(await screen.findByText('Add Override'));
    await waitFor(() => expect(screen.getByText('Add Component Override')).toBeInTheDocument());
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'c9' } });
    const dateInput = document.querySelector('form input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } });
    const submitOv = screen.getAllByRole('button', { name: 'Add Override' }).pop() as HTMLElement;
    fireEvent.click(submitOv);
    await waitFor(() => expect(mockApi.employees.overrides.create).toHaveBeenCalled());
    expect(screen.getByText('Add Component Override')).toBeInTheDocument();
  });

  it('WHEN an override is removed THEN overrides.remove is called and the list reloads', async () => {
    mockApi.employees.overrides.remove.mockResolvedValue({});
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    fireEvent.click(await screen.findByLabelText('Remove override'));
    await waitFor(() => expect(mockApi.employees.overrides.remove).toHaveBeenCalledWith('p1', 'ov1'));
  });

  it('WHEN removal fails THEN the row stays', async () => {
    mockApi.employees.overrides.remove.mockRejectedValue(new Error('nope'));
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    fireEvent.click(await screen.findByLabelText('Remove override'));
    await waitFor(() => expect(mockApi.employees.overrides.remove).toHaveBeenCalled());
    expect(screen.getByText(/LOAN_EMI/)).toBeInTheDocument();
  });

  it('WHEN there are no overrides THEN the explanatory empty text shows', async () => {
    mockApi.employees.overrides.list.mockResolvedValue({ data: [], total: 0 });
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    await waitFor(() => expect(screen.getByText(/No component overrides/)).toBeInTheDocument());
  });

  it('WHEN loading overrides fails THEN the section shows the empty text', async () => {
    mockApi.employees.overrides.list.mockRejectedValue(new Error('down'));
    renderTab();
    fireEvent.click(await screen.findByText('Components & Overrides'));
    await waitFor(() => expect(screen.getByText(/No component overrides/)).toBeInTheDocument());
  });
});

// =============================================================================
// Benefits
// =============================================================================

describe('GIVEN the Benefits section', () => {
  it('WHEN it opens THEN assigned benefits render with amount and start date', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Benefits'));
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    expect(screen.getByText(/Amount 1800 · from 2026-01-01/)).toBeInTheDocument();
  });

  it('WHEN a benefit has no amount override THEN it shows Default amount', async () => {
    mockApi.employees.benefits.list.mockResolvedValue({
      data: [{ ...benefit, amount_override: null, benefit_type_name: undefined }], total: 1,
    });
    renderTab();
    fireEvent.click(await screen.findByText('Benefits'));
    await waitFor(() => expect(screen.getByText(/Default amount · from 2026-01-01/)).toBeInTheDocument());
    // Falls back to the type id when the name is missing
    expect(screen.getByText('bt1')).toBeInTheDocument();
  });

  it('WHEN a benefit is added THEN benefits.create receives the form', async () => {
    mockApi.employees.benefits.create.mockResolvedValue(benefit);
    renderTab();
    fireEvent.click(await screen.findByText('Benefits'));
    fireEvent.click(await screen.findByText('Add Benefit'));
    await waitFor(() => expect(screen.getByText('Benefit Type *')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bt1' } });
    const amount = document.querySelector('form input[type="number"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '2000' } });
    const dateInput = document.querySelector('form input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-10-01' } });
    const submitBn = screen.getAllByRole('button', { name: 'Add Benefit' }).pop() as HTMLElement;
    fireEvent.click(submitBn);
    await waitFor(() => expect(mockApi.employees.benefits.create).toHaveBeenCalledWith('p1', expect.objectContaining({
      benefit_type_id: 'bt1', amount_override: 2000, effective_from: '2026-10-01',
    })));
  });

  it('WHEN required fields are missing THEN no benefit is created', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Benefits'));
    fireEvent.click(await screen.findByText('Add Benefit'));
    await waitFor(() => expect(screen.getByText('Benefit Type *')).toBeInTheDocument());
    const submitBn = screen.getAllByRole('button', { name: 'Add Benefit' }).pop() as HTMLElement;
    fireEvent.click(submitBn);
    expect(mockApi.employees.benefits.create).not.toHaveBeenCalled();
  });

  it('WHEN adding the benefit fails THEN the modal stays open', async () => {
    mockApi.employees.benefits.create.mockRejectedValue(new Error('nope'));
    renderTab();
    fireEvent.click(await screen.findByText('Benefits'));
    fireEvent.click(await screen.findByText('Add Benefit'));
    await waitFor(() => expect(screen.getByText('Benefit Type *')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bt1' } });
    const dateInput = document.querySelector('form input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-10-01' } });
    const submitBn = screen.getAllByRole('button', { name: 'Add Benefit' }).pop() as HTMLElement;
    fireEvent.click(submitBn);
    await waitFor(() => expect(mockApi.employees.benefits.create).toHaveBeenCalled());
    expect(screen.getByText('Benefit Type *')).toBeInTheDocument();
  });

  it('WHEN a benefit is removed THEN benefits.remove is called', async () => {
    mockApi.employees.benefits.remove.mockResolvedValue({});
    renderTab();
    fireEvent.click(await screen.findByText('Benefits'));
    fireEvent.click(await screen.findByLabelText('Remove benefit'));
    await waitFor(() => expect(mockApi.employees.benefits.remove).toHaveBeenCalledWith('p1', 'eb1'));
  });

  it('WHEN removing fails THEN the benefit stays listed', async () => {
    mockApi.employees.benefits.remove.mockRejectedValue(new Error('nope'));
    renderTab();
    fireEvent.click(await screen.findByText('Benefits'));
    fireEvent.click(await screen.findByLabelText('Remove benefit'));
    await waitFor(() => expect(mockApi.employees.benefits.remove).toHaveBeenCalled());
    expect(screen.getByText('Health Insurance')).toBeInTheDocument();
  });

  it('WHEN there are no benefits THEN the empty text shows', async () => {
    mockApi.employees.benefits.list.mockResolvedValue({ data: [], total: 0 });
    renderTab();
    fireEvent.click(await screen.findByText('Benefits'));
    await waitFor(() => expect(screen.getByText('No benefits assigned to this employee.')).toBeInTheDocument());
  });

  it('WHEN loading benefits fails THEN the section degrades to the empty text', async () => {
    mockApi.employees.benefits.list.mockRejectedValue(new Error('down'));
    renderTab();
    fireEvent.click(await screen.findByText('Benefits'));
    await waitFor(() => expect(screen.getByText('No benefits assigned to this employee.')).toBeInTheDocument());
  });
});

// =============================================================================
// Tax & statutory (saving + regime + aadhaar identifier editing)
// =============================================================================

describe('GIVEN the Tax & Statutory section', () => {
  it('WHEN identifiers (incl. aadhaar) are edited and saved THEN updateProfile receives them with the regime', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Tax & Statutory'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Aadhaar' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: 'Aadhaar' }), { target: { value: '999988887777' } });
    fireEvent.click(screen.getByText('Old Regime'));
    fireEvent.click(screen.getByText('Save Tax & Statutory'));
    await waitFor(() => expect(mockApi.employees.updateProfile).toHaveBeenCalledWith('p1', {
      statutory_identifiers: { pan: 'ABCDE1234F', aadhaar: '999988887777' },
      tax_regime: 'old',
    }));
  });

  it('WHEN a required identifier is cleared THEN the blocking hint appears', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Tax & Statutory'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'PAN' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: 'PAN' }), { target: { value: '' } });
    await waitFor(() => expect(screen.getByText(/PAN is required before this employee/)).toBeInTheDocument());
  });

  it('WHEN saving fails THEN the section stays editable', async () => {
    mockApi.employees.updateProfile.mockRejectedValue(new Error('nope'));
    renderTab();
    fireEvent.click(await screen.findByText('Tax & Statutory'));
    await waitFor(() => expect(screen.getByText('Save Tax & Statutory')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Tax & Statutory'));
    await waitFor(() => expect(mockApi.employees.updateProfile).toHaveBeenCalled());
    expect(screen.getByText('Save Tax & Statutory')).toBeInTheDocument();
  });

  it('WHEN the statutory config fails to load THEN the identifiers form degrades to empty', async () => {
    mockApi.statutory.get.mockRejectedValue(new Error('down'));
    renderTab();
    fireEvent.click(await screen.findByText('Tax & Statutory'));
    await waitFor(() => expect(screen.getByText('Save Tax & Statutory')).toBeInTheDocument());
    expect(screen.queryByRole('textbox', { name: 'PAN' })).not.toBeInTheDocument();
  });
});

// =============================================================================
// Bank (reveal-permitted paths + add account)
// =============================================================================

describe('GIVEN the Bank section for a viewer with the reveal permission', () => {
  beforeEach(() => {
    shellBridgeState.permissions = ['payroll.bank_reveal'];
  });

  it('WHEN Reveal is clicked THEN the audited endpoint is called once and the full number replaces the mask', async () => {
    mockApi.employees.bankAccounts.reveal.mockResolvedValue({ account_number: '123456789012' });
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    await waitFor(() => expect(screen.getByText('Reveal')).toBeInTheDocument());
    expect(screen.getByText(/Revealing the full account number is recorded/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reveal'));
    await waitFor(() => expect(mockApi.employees.bankAccounts.reveal).toHaveBeenCalledWith('p1', 'b1'));
    await waitFor(() => expect(screen.getByText(/123456789012/)).toBeInTheDocument());
    // Reveal affordance disappears once revealed
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument();
  });

  it('WHEN the reveal fails THEN the mask stays', async () => {
    mockApi.employees.bankAccounts.reveal.mockRejectedValue(new Error('403'));
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    fireEvent.click(await screen.findByText('Reveal'));
    await waitFor(() => expect(mockApi.employees.bankAccounts.reveal).toHaveBeenCalled());
    expect(screen.getByText(/•••• 9012/)).toBeInTheDocument();
  });
});

describe('GIVEN the Bank section add-account flow', () => {
  it('WHEN there is no account THEN the payroll-blocking warning shows', async () => {
    mockApi.employees.bankAccounts.list.mockResolvedValue({ data: [], total: 0 });
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    await waitFor(() => expect(screen.getByText(/Bank account is required before this employee/)).toBeInTheDocument());
  });

  it('WHEN loading accounts fails THEN the warning shows instead of crashing', async () => {
    mockApi.employees.bankAccounts.list.mockRejectedValue(new Error('down'));
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    await waitFor(() => expect(screen.getByText(/Bank account is required before this employee/)).toBeInTheDocument());
  });

  it('WHEN a new account is added THEN bankAccounts.create receives the payload with uppercased IFSC', async () => {
    mockApi.employees.bankAccounts.create.mockResolvedValue({});
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    fireEvent.click(await screen.findByText('Add Bank Account'));
    await waitFor(() => expect(screen.getByText('Bank Name *')).toBeInTheDocument());
    const textInputs = Array.from(document.querySelectorAll('form input[type="text"]'));
    fireEvent.change(textInputs[0], { target: { value: 'ICICI' } });
    fireEvent.change(textInputs[1], { target: { value: 'Asha Nair' } });
    fireEvent.change(textInputs[2], { target: { value: '000111222333' } });
    fireEvent.change(textInputs[3], { target: { value: 'icic0004444' } });
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'current' } });
    fireEvent.change(selects[1], { target: { value: 'upi' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
    await waitFor(() => expect(mockApi.employees.bankAccounts.create).toHaveBeenCalledWith('p1', expect.objectContaining({
      bank_name: 'ICICI', account_holder: 'Asha Nair', account_number: '000111222333',
      ifsc: 'ICIC0004444', account_type: 'current', payment_method: 'upi', is_primary: false,
    })));
  });

  it('WHEN the bank modal is cancelled THEN it closes without creating', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    fireEvent.click(await screen.findByText('Add Bank Account'));
    await waitFor(() => expect(screen.getByText('Bank Name *')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Bank Name *')).not.toBeInTheDocument());
    expect(mockApi.employees.bankAccounts.create).not.toHaveBeenCalled();
  });

  it('WHEN required fields are missing THEN no account is created', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    fireEvent.click(await screen.findByText('Add Bank Account'));
    await waitFor(() => expect(screen.getByText('Bank Name *')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
    expect(mockApi.employees.bankAccounts.create).not.toHaveBeenCalled();
  });

  it('WHEN account creation fails THEN the modal stays open', async () => {
    mockApi.employees.bankAccounts.create.mockRejectedValue(new Error('nope'));
    renderTab();
    fireEvent.click(await screen.findByText('Bank'));
    fireEvent.click(await screen.findByText('Add Bank Account'));
    await waitFor(() => expect(screen.getByText('Bank Name *')).toBeInTheDocument());
    const textInputs = Array.from(document.querySelectorAll('form input[type="text"]'));
    fireEvent.change(textInputs[0], { target: { value: 'ICICI' } });
    fireEvent.change(textInputs[1], { target: { value: 'Asha' } });
    fireEvent.change(textInputs[2], { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
    await waitFor(() => expect(mockApi.employees.bankAccounts.create).toHaveBeenCalled());
    expect(screen.getByText('Bank Name *')).toBeInTheDocument();
  });
});

// =============================================================================
// Documents + History
// =============================================================================

describe('GIVEN the Documents section', () => {
  it('WHEN opened THEN it links to the person documents instead of duplicating them', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Documents'));
    await waitFor(() => expect(screen.getByText('Open documents')).toBeInTheDocument());
    expect(screen.getByText('Open documents').closest('a')).toHaveAttribute('href', '/people/p1?tab=overview');
  });
});

describe('GIVEN the History section', () => {
  it('WHEN events exist THEN the timeline shows description, timestamp and actor', async () => {
    mockApi.employees.history.mockResolvedValue({
      data: [
        { id: 'h1', event_type: 'salary.revised', description: 'Salary revised to 50k', actor_name: 'HR Admin', created_at: '2026-01-01T10:00:00Z' },
        { id: 'h2', event_type: 'profile_updated', created_at: '2026-01-02T10:00:00Z' },
      ],
      total: 2,
    });
    renderTab();
    fireEvent.click(await screen.findByText('History'));
    await waitFor(() => expect(screen.getByText('Salary revised to 50k')).toBeInTheDocument());
    expect(screen.getByText(/HR Admin/)).toBeInTheDocument();
    // Event without description falls back to a humanized event type
    expect(screen.getByText('profile updated')).toBeInTheDocument();
  });

  it('WHEN there is no history THEN the empty text shows', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('History'));
    await waitFor(() => expect(screen.getByText('No payroll history yet for this employee.')).toBeInTheDocument());
  });

  it('WHEN the history API fails THEN the section degrades to the empty text', async () => {
    mockApi.employees.history.mockRejectedValue(new Error('down'));
    renderTab();
    fireEvent.click(await screen.findByText('History'));
    await waitFor(() => expect(screen.getByText('No payroll history yet for this employee.')).toBeInTheDocument());
  });
});
