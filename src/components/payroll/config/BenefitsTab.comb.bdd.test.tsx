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
import { toast } from '@so360/design-system';

const mockApi = payrollApi as any;
const benefit = { id: 'b1', name: 'Health Insurance', description: '', default_amount: 1500, taxable: false, payer: 'employer', frequency: 'per_period', is_active: true };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
  mockApi.benefitTypes.list.mockResolvedValue({ data: [benefit], total: 1 });
});

describe('GIVEN the Comb benefits tab', () => {
  it('WHEN it loads THEN the benefit row and the New Benefit Type action render', async () => {
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    expect(screen.getByText('New Benefit Type')).toBeInTheDocument();
  });

  it('WHEN the list is empty THEN the empty state renders', async () => {
    mockApi.benefitTypes.list.mockResolvedValue({ data: [], total: 0 });
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('No benefit types')).toBeInTheDocument());
  });

  it('WHEN a benefit is created THEN benefitTypes.create receives the typed name', async () => {
    mockApi.benefitTypes.create.mockResolvedValue({ ...benefit, id: 'b2', name: 'Meal Card' });
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Benefit Type'));
    await waitFor(() => expect(screen.getByPlaceholderText('Health Insurance')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Health Insurance'), { target: { value: 'Meal Card' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.benefitTypes.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Meal Card' })));
  });

  it('WHEN saving fails THEN an error toast is shown', async () => {
    mockApi.benefitTypes.create.mockRejectedValue(new Error('boom'));
    render(<BenefitsTab />);
    await waitFor(() => expect(screen.getByText('Health Insurance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Benefit Type'));
    await waitFor(() => expect(screen.getByPlaceholderText('Health Insurance')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Health Insurance'), { target: { value: 'Gym' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save benefit type'));
  });
});
