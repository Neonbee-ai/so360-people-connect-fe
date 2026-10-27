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
import { toast } from '@so360/design-system';

const mockApi = payrollApi as any;
const comp = { id: 'c1', code: 'BASIC', name: 'Basic Salary', kind: 'earning', calc_type: 'fixed', calc_config: { amount: 50000 }, frequency: 'per_period', taxable: true, is_statutory: false, statutory_code: null, prorate_on_lop: true, is_active: true };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
  mockApi.components.list.mockResolvedValue({ data: [comp], total: 1 });
});

describe('GIVEN the Comb components tab', () => {
  it('WHEN it loads THEN the component row and New Component action render', async () => {
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    expect(screen.getByText('Basic Salary')).toBeInTheDocument();
    expect(screen.getByText('New Component')).toBeInTheDocument();
  });

  it('WHEN no components exist THEN the list shows no rows', async () => {
    mockApi.components.list.mockResolvedValue({ data: [], total: 0 });
    render(<ComponentsTab />);
    await waitFor(() => expect(mockApi.components.list).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('BASIC')).not.toBeInTheDocument());
  });

  it('WHEN calc type is fixed THEN Default Amount shows and Percentage fields are gated off', async () => {
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Component'));
    await waitFor(() => expect(screen.getByLabelText('Code')).toBeInTheDocument());
    expect(screen.getByText('Default Amount')).toBeInTheDocument();
    expect(screen.queryByText('Percentage *')).not.toBeInTheDocument();
  });

  it('WHEN a component is created THEN components.create gets the typed code and name', async () => {
    mockApi.components.create.mockResolvedValue({ ...comp, id: 'c2', code: 'BONUS', name: 'Bonus' });
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Component'));
    await waitFor(() => expect(screen.getByLabelText('Code')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'BONUS' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bonus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.components.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'BONUS', name: 'Bonus' })));
  });

  it('WHEN saving fails THEN the API message is toasted', async () => {
    mockApi.components.create.mockRejectedValue(new Error('Code already exists'));
    render(<ComponentsTab />);
    await waitFor(() => expect(screen.getByText('BASIC')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Component'));
    await waitFor(() => expect(screen.getByLabelText('Code')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'BASIC' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Code already exists'));
  });
});
