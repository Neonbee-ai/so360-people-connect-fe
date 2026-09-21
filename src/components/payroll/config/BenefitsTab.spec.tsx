import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../../services/payrollApi', () => ({
  payrollApi: {
    benefitTypes: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  },
}));

import BenefitsTab from './BenefitsTab';
import { payrollApi } from '../../../services/payrollApi';

const mockApi = payrollApi as any;

const benefit = {
  id: 'b1', name: 'Health Insurance', description: '',
  default_amount: 1500, taxable: false, payer: 'employer', frequency: 'per_period', is_active: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.benefitTypes.list.mockResolvedValue({ data: [benefit], total: 1 });
});

describe('GIVEN the benefit types tab', () => {
  it('WHEN it loads THEN each benefit row shows name, amount, payer, taxable and status', async () => {
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText('employer')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('WHEN a benefit has no default amount and is inactive THEN a dash and Inactive chip render', async () => {
    mockApi.benefitTypes.list.mockResolvedValue({
      data: [{ ...benefit, default_amount: undefined, taxable: true, is_active: false }],
      total: 1,
    });
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('WHEN no benefit types exist THEN the empty state offers creating one', async () => {
    mockApi.benefitTypes.list.mockResolvedValue({ data: [], total: 0 });
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('No benefit types')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('New Benefit Type')[1]);
    await waitFor(() => expect(screen.getByText('Name *')).toBeInTheDocument());
  });

  it('WHEN the list API fails THEN the tab falls back to the empty state', async () => {
    mockApi.benefitTypes.list.mockRejectedValue(new Error('down'));
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('No benefit types')).toBeInTheDocument());
  });
});

describe('GIVEN the benefit type modal', () => {
  it('WHEN a new benefit is created THEN benefitTypes.create receives the form and the list reloads', async () => {
    mockApi.benefitTypes.create.mockResolvedValue({ ...benefit, id: 'b2' });
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Benefit Type'));
    await waitFor(() => expect(screen.getByPlaceholderText('Health Insurance')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Health Insurance'), { target: { value: 'Meal Card' } });
    // default amount + payer + checkboxes
    const amount = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '2200' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'shared' } });
    const [taxable] = screen.getAllByRole('checkbox');
    fireEvent.click(taxable);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.benefitTypes.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Meal Card',
      default_amount: 2200,
      payer: 'shared',
      taxable: true,
    })));
    expect(mockApi.benefitTypes.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('WHEN the amount is cleared THEN it is saved as undefined (use the type default)', async () => {
    mockApi.benefitTypes.create.mockResolvedValue({ ...benefit, id: 'b3' });
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Benefit Type'));
    await waitFor(() => expect(screen.getByPlaceholderText('Health Insurance')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Health Insurance'), { target: { value: 'Gym' } });
    const amount = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '10' } });
    fireEvent.change(amount, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.benefitTypes.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Gym', default_amount: undefined,
    })));
  });

  it('WHEN the name is empty THEN submit does nothing', async () => {
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Benefit Type'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(mockApi.benefitTypes.create).not.toHaveBeenCalled();
  });

  it('WHEN Cancel is clicked THEN the modal closes without saving', async () => {
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Benefit Type'));
    await waitFor(() => expect(screen.getByText('Name *')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Name *')).not.toBeInTheDocument());
    expect(mockApi.benefitTypes.create).not.toHaveBeenCalled();
  });

  it('WHEN Edit is used THEN the modal pre-fills and benefitTypes.update is called', async () => {
    mockApi.benefitTypes.update.mockResolvedValue(benefit);
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByText('Edit Benefit Type')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Health Insurance')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Health Insurance'), { target: { value: 'Health Cover' } });
    // Active checkbox toggle covers the is_active branch
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(mockApi.benefitTypes.update).toHaveBeenCalledWith('b1', expect.objectContaining({
      name: 'Health Cover',
      is_active: false,
    })));
  });

  it('WHEN saving fails THEN the modal stays open', async () => {
    mockApi.benefitTypes.update.mockRejectedValue(new Error('nope'));
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByText('Edit Benefit Type')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(mockApi.benefitTypes.update).toHaveBeenCalled());
    expect(screen.getByText('Edit Benefit Type')).toBeInTheDocument();
  });
});
