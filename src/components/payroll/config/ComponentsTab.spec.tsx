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

const mockComponent = {
  id: 'c1', code: 'BASIC', name: 'Basic Salary', kind: 'earning',
  calc_type: 'fixed', calc_config: { amount: 50000 }, frequency: 'per_period',
  taxable: true, is_statutory: false, statutory_code: null,
  prorate_on_lop: true, is_active: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.components.list.mockResolvedValue({ data: [mockComponent], total: 1 });
});

describe('GIVEN the Components configuration tab', () => {
  it('WHEN components load THEN the table shows code, name and kind chip', async () => {
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    expect(screen.getByText('Basic Salary')).toBeInTheDocument();
    expect(screen.getByText('Earning')).toBeInTheDocument();
  });
});

describe('GIVEN the component modal with calc-type-dependent fields', () => {
  const openModal = async () => {
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Component'));
    await waitFor(() => expect(screen.getByText('Code *')).toBeInTheDocument());
  };

  it('WHEN calc type is fixed THEN the Default Amount field renders', async () => {
    await openModal();
    expect(screen.getByText('Default Amount')).toBeInTheDocument();
    expect(screen.queryByText('Percentage *')).not.toBeInTheDocument();
    expect(screen.queryByText('Formula Expression *')).not.toBeInTheDocument();
  });

  it('WHEN calc type switches to percent_of THEN percentage fields replace the fixed amount', async () => {
    await openModal();
    fireEvent.change(screen.getByDisplayValue('Fixed amount'), { target: { value: 'percent_of' } });
    await waitFor(() => expect(screen.getByText('Percentage *')).toBeInTheDocument());
    expect(screen.getByText('Of Component *')).toBeInTheDocument();
    expect(screen.queryByText('Default Amount')).not.toBeInTheDocument();
  });

  it('WHEN calc type switches to formula THEN the expression field renders', async () => {
    await openModal();
    fireEvent.change(screen.getByDisplayValue('Fixed amount'), { target: { value: 'formula' } });
    await waitFor(() => expect(screen.getByText('Formula Expression *')).toBeInTheDocument());
    expect(screen.queryByText('Percentage *')).not.toBeInTheDocument();
  });

  it('WHEN a percent_of component is submitted without a base THEN a human validation message appears and no API call happens', async () => {
    await openModal();
    fireEvent.change(screen.getByPlaceholderText('HRA'), { target: { value: 'HRA' } });
    fireEvent.change(screen.getByPlaceholderText('House Rent Allowance'), { target: { value: 'House Rent Allowance' } });
    fireEvent.change(screen.getByDisplayValue('Fixed amount'), { target: { value: 'percent_of' } });
    await waitFor(() => expect(screen.getByText('Percentage *')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('40'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.getByText('Choose which component the percentage is based on.')).toBeInTheDocument());
    expect(mockApi.components.create).not.toHaveBeenCalled();
  });
});
