import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../../services/payrollApi', () => ({
  payrollApi: {
    components: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  },
}));

import ComponentsTab from './ComponentsTab';
import { payrollApi } from '../../../services/payrollApi';

const mockApi = payrollApi as any;

const fixedComponent = {
  id: 'c1', code: 'BASIC', name: 'Basic Salary', kind: 'earning',
  calc_type: 'fixed', calc_config: { amount: 50000 }, frequency: 'per_period',
  taxable: true, is_statutory: false, statutory_code: null,
  prorate_on_lop: true, is_active: true,
};

const statutoryComponent = {
  id: 'c2', code: 'PF_EMP', name: 'Provident Fund (Employee)', kind: 'deduction',
  calc_type: 'slab', calc_config: { basis: 'PF_WAGES' }, frequency: 'per_period',
  taxable: false, is_statutory: true, statutory_code: 'PF_EMP',
  prorate_on_lop: false, is_active: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.components.list.mockResolvedValue({ data: [fixedComponent, statutoryComponent], total: 2 });
});

describe('GIVEN the components list states', () => {
  it('WHEN a statutory component renders THEN its statutory chip and inactive status show', async () => {
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getAllByText('PF_EMP').length).toBeGreaterThan(0));
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('slab')).toBeInTheDocument();
  });

  it('WHEN there are no components THEN the empty state offers creating one', async () => {
    mockApi.components.list.mockResolvedValue({ data: [], total: 0 });
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('No salary components')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('New Component')[1]);
    await waitFor(() => expect(screen.getByText('Code *')).toBeInTheDocument());
  });

  it('WHEN the list API fails THEN the tab falls back to the empty state', async () => {
    mockApi.components.list.mockRejectedValue(new Error('down'));
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('No salary components')).toBeInTheDocument());
  });
});

describe('GIVEN the component create flow', () => {
  const openNew = async () => {
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Component'));
    await waitFor(() => expect(screen.getByText('Code *')).toBeInTheDocument());
  };

  it('WHEN a fixed component is submitted THEN components.create receives it and the list reloads', async () => {
    mockApi.components.create.mockResolvedValue({ ...fixedComponent, id: 'c3' });
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: 'ta' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'Travel Allowance' } });
    fireEvent.change(screen.getByDisplayValue('Earning'), { target: { value: 'deduction' } });
    fireEvent.change(screen.getByDisplayValue('Per period'), { target: { value: 'one_time' } });
    const amount = document.querySelector('form input[type="number"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.components.create).toHaveBeenCalledWith(expect.objectContaining({
      code: 'TA', name: 'Travel Allowance', kind: 'deduction',
      frequency: 'one_time', calc_config: { amount: 1200 },
    })));
    expect(mockApi.components.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('WHEN the code is not UPPER_SNAKE_CASE THEN a human validation message blocks the save', async () => {
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: '9BAD' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'Bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.getByText(/Code must be UPPER_SNAKE_CASE/)).toBeInTheDocument());
    expect(mockApi.components.create).not.toHaveBeenCalled();
  });

  it('WHEN a component is switched to fixed without an amount THEN the fixed-amount validation shows', async () => {
    // The slab component has no calc_config.amount — switching it to fixed
    // leaves the amount undefined, which the validator must refuse.
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Edit')[1]);
    await waitFor(() => expect(screen.getByText('Edit Component')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('Slab table'), { target: { value: 'fixed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(screen.getByText('A fixed component needs a non-negative default amount.')).toBeInTheDocument());
    expect(mockApi.components.update).not.toHaveBeenCalled();
  });

  it('WHEN a formula component has no expression THEN the formula validation message shows, and a filled one saves', async () => {
    mockApi.components.create.mockResolvedValue({});
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: 'SPECIAL' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'Special Allowance' } });
    fireEvent.change(screen.getByDisplayValue('Fixed amount'), { target: { value: 'formula' } });
    await waitFor(() => expect(screen.getByText('Formula Expression *')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.getByText('A formula component needs an expression.')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('BASIC * 0.4 + 1000'), { target: { value: 'GROSS - BASIC - HRA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.components.create).toHaveBeenCalledWith(expect.objectContaining({
      calc_type: 'formula', calc_config: expect.objectContaining({ expr: 'GROSS - BASIC - HRA' }),
    })));
  });

  it('WHEN a slab component is chosen THEN the basis field renders and uppercases', async () => {
    mockApi.components.create.mockResolvedValue({});
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: 'PT' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'Professional Tax' } });
    fireEvent.change(screen.getByDisplayValue('Fixed amount'), { target: { value: 'slab' } });
    await waitFor(() => expect(screen.getByText('Slab Basis')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('GROSS_ANNUAL'), { target: { value: 'gross_annual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.components.create).toHaveBeenCalledWith(expect.objectContaining({
      calc_type: 'slab', calc_config: expect.objectContaining({ basis: 'GROSS_ANNUAL' }),
    })));
  });

  it('WHEN a percent_of component is fully specified THEN percent and base are saved', async () => {
    mockApi.components.create.mockResolvedValue({});
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: 'HRA' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'House Rent Allowance' } });
    fireEvent.change(screen.getByDisplayValue('Fixed amount'), { target: { value: 'percent_of' } });
    await waitFor(() => expect(screen.getByText('Percentage *')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('40'), { target: { value: '40' } });
    fireEvent.change(screen.getByPlaceholderText('BASIC'), { target: { value: 'basic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.components.create).toHaveBeenCalledWith(expect.objectContaining({
      calc_type: 'percent_of', calc_config: expect.objectContaining({ percent: 40, of: 'BASIC' }),
    })));
  });

  it('WHEN a percent_of component has no percentage THEN its validation message shows', async () => {
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: 'HRA' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'HRA' } });
    fireEvent.change(screen.getByDisplayValue('Fixed amount'), { target: { value: 'percent_of' } });
    await waitFor(() => expect(screen.getByText('Percentage *')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.getByText('A percentage component needs a percentage greater than zero.')).toBeInTheDocument());
  });

  it('WHEN statutory is ticked without a code THEN the statutory validation blocks, and picking a code saves', async () => {
    mockApi.components.create.mockResolvedValue({});
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: 'ESI_EMP' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'ESI Employee' } });
    // Checkboxes: taxable, statutory, prorate, active
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    await waitFor(() => expect(screen.getByText('Statutory Code *')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.getByText('Pick the statutory code this component maps to.')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('Select…'), { target: { value: 'ESI_EMP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.components.create).toHaveBeenCalledWith(expect.objectContaining({
      is_statutory: true, statutory_code: 'ESI_EMP',
    })));
  });

  it('WHEN the remaining checkboxes are toggled THEN taxable, prorate and active flip in the payload', async () => {
    mockApi.components.create.mockResolvedValue({});
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: 'BONUS' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'Bonus' } });
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // taxable off
    fireEvent.click(checkboxes[2]); // prorate on
    fireEvent.click(checkboxes[3]); // active off
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.components.create).toHaveBeenCalledWith(expect.objectContaining({
      taxable: false, prorate_on_lop: true, is_active: false,
    })));
  });

  it('WHEN the save API fails THEN the modal stays open', async () => {
    mockApi.components.create.mockRejectedValue(new Error('duplicate code'));
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: 'DUP' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'Dup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.components.create).toHaveBeenCalled());
    expect(screen.getByText('Code *')).toBeInTheDocument();
  });
});

describe('GIVEN modal dismissal', () => {
  it('WHEN Cancel is clicked THEN the modal closes without saving', async () => {
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Component'));
    await waitFor(() => expect(screen.getByText('Code *')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Code *')).not.toBeInTheDocument());
    expect(mockApi.components.create).not.toHaveBeenCalled();
  });
});

describe('GIVEN the component edit flow', () => {
  it('WHEN Edit is clicked THEN the modal pre-fills, disables the code and updates via the API', async () => {
    mockApi.components.update.mockResolvedValue(fixedComponent);
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Edit')[0]);
    await waitFor(() => expect(screen.getByText('Edit Component')).toBeInTheDocument());
    const codeInput = screen.getByDisplayValue('BASIC') as HTMLInputElement;
    expect(codeInput).toBeDisabled();
    fireEvent.change(screen.getByDisplayValue('Basic Salary'), { target: { value: 'Basic Pay' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(mockApi.components.update).toHaveBeenCalledWith('c1', expect.objectContaining({
      code: 'BASIC', name: 'Basic Pay',
    })));
  });
});
