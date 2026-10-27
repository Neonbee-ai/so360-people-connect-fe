import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../../services/payrollApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/payrollApi')>()),
  payrollApi: {
    groups: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
    periods: { list: vi.fn(), generate: vi.fn() },
  },
}));

import GroupsPeriodsTab from './GroupsPeriodsTab';
import { payrollApi } from '../../../services/payrollApi';
import { toast } from '@so360/design-system';

const mockApi = payrollApi as any;
const groupA = { id: 'g1', name: 'Monthly Staff', code: 'MONTHLY', description: '', is_default: true, is_active: true };
const period = { id: 'per1', payroll_group_id: 'g1', period_start: '2026-08-01', period_end: '2026-08-31', pay_date: '2026-08-31', status: 'open' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
  mockApi.groups.list.mockResolvedValue({ data: [groupA], total: 1 });
  mockApi.periods.list.mockResolvedValue({ data: [period], total: 1 });
});

describe('GIVEN the Comb groups & periods tab', () => {
  it('WHEN it loads THEN the default group and its period render', async () => {
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Monthly Staff')).toBeInTheDocument());
    expect(screen.getByText('Default')).toBeInTheDocument();
    await waitFor(() => expect(mockApi.periods.list).toHaveBeenCalledWith({ group_id: 'g1' }));
  });

  it('WHEN a group has no periods THEN the empty state explains how to generate them', async () => {
    mockApi.periods.list.mockResolvedValue({ data: [], total: 0 });
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText(/No periods yet for this group/)).toBeInTheDocument());
  });

  it('WHEN a new group is created THEN groups.create receives name and code', async () => {
    mockApi.groups.create.mockResolvedValue({ ...groupA, id: 'g3', name: 'Interns', code: 'INTERN', is_default: false });
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('New Group')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Group'));
    await waitFor(() => expect(screen.getByPlaceholderText('Monthly Staff')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Monthly Staff'), { target: { value: 'Interns' } });
    fireEvent.change(screen.getByPlaceholderText('MONTHLY'), { target: { value: 'INTERN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.groups.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Interns', code: 'INTERN' })));
  });

  it('WHEN saving a group fails THEN an error toast is shown', async () => {
    mockApi.groups.create.mockRejectedValue(new Error('x'));
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('New Group')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Group'));
    await waitFor(() => expect(screen.getByPlaceholderText('Monthly Staff')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Monthly Staff'), { target: { value: 'Interns' } });
    fireEvent.change(screen.getByPlaceholderText('MONTHLY'), { target: { value: 'INTERN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save payroll group'));
  });
});
