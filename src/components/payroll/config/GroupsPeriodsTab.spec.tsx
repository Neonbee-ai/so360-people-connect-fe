import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// Only the network layer is faked. toFromMonth stays real so these specs
// exercise the actual date -> YYYY-MM narrowing the API depends on.
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
const groupB = { id: 'g2', name: 'Contractors', code: 'CONTRACT', description: '', is_default: false, is_active: true };

const period = {
  id: 'per1', payroll_group_id: 'g1',
  period_start: '2026-08-01', period_end: '2026-08-31', pay_date: '2026-08-31', status: 'open',
};

beforeEach(() => {
  vi.resetAllMocks();
  // The design-system stub exports plain functions; spy so toast copy is assertable.
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
  mockApi.groups.list.mockResolvedValue({ data: [groupA, groupB], total: 2 });
  mockApi.periods.list.mockResolvedValue({ data: [period], total: 1 });
});

describe('GIVEN the groups & periods tab', () => {
  it('WHEN it loads THEN the default group is auto-selected and its periods load', async () => {
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Monthly Staff')).toBeInTheDocument());
    expect(screen.getByText('Default')).toBeInTheDocument();
    await waitFor(() => expect(mockApi.periods.list).toHaveBeenCalledWith({ group_id: 'g1' }));
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('WHEN another group is selected THEN its periods are fetched', async () => {
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Contractors')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Contractors'));
    await waitFor(() => expect(mockApi.periods.list).toHaveBeenCalledWith({ group_id: 'g2' }));
  });

  it('WHEN a group has no periods THEN the tab explains how to generate them', async () => {
    mockApi.periods.list.mockResolvedValue({ data: [], total: 0 });
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText(/No periods yet for this group/)).toBeInTheDocument());
  });

  it('WHEN loading periods fails THEN the groups still render', async () => {
    mockApi.periods.list.mockRejectedValue(new Error('down'));
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Monthly Staff')).toBeInTheDocument());
  });

  it('WHEN loading groups fails THEN the tab shows the empty state', async () => {
    mockApi.groups.list.mockRejectedValue(new Error('down'));
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('No payroll groups')).toBeInTheDocument());
  });
});

describe('GIVEN the group create/edit modal', () => {
  it('WHEN a new group is created THEN groups.create receives the form and the list reloads', async () => {
    mockApi.groups.create.mockResolvedValue({ ...groupB, id: 'g3' });
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('New Group')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Group'));
    await waitFor(() => expect(screen.getByText('New Payroll Group')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Monthly Staff'), { target: { value: 'Weekly Crew' } });
    fireEvent.change(screen.getByPlaceholderText('MONTHLY'), { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.groups.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Weekly Crew',
      code: 'WEEKLY', // code input upper-cases as you type
    })));
    expect(mockApi.groups.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('WHEN the name or code is missing THEN submit does nothing', async () => {
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('New Group')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Group'));
    await waitFor(() => expect(screen.getByText('New Payroll Group')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Monthly Staff'), { target: { value: 'Only Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(mockApi.groups.create).not.toHaveBeenCalled();
  });

  it('WHEN Edit is used on a group THEN the modal pre-fills and groups.update is called', async () => {
    mockApi.groups.update.mockResolvedValue(groupA);
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Monthly Staff')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Edit')[0]);
    await waitFor(() => expect(screen.getByText('Edit Payroll Group')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Monthly Staff')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Monthly Staff'), { target: { value: 'Monthly Team' } });
    // Toggle the default checkbox branch too
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(mockApi.groups.update).toHaveBeenCalledWith('g1', expect.objectContaining({
      name: 'Monthly Team',
      is_default: false,
    })));
  });

  it('WHEN Edit is triggered via keyboard THEN the modal also opens', async () => {
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Monthly Staff')).toBeInTheDocument());
    fireEvent.keyDown(screen.getAllByText('Edit')[1], { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Edit Payroll Group')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Contractors')).toBeInTheDocument();
  });

  it('WHEN saving the group fails THEN the modal stays open', async () => {
    mockApi.groups.update.mockRejectedValue(new Error('nope'));
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Monthly Staff')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Edit')[0]);
    await waitFor(() => expect(screen.getByText('Edit Payroll Group')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(mockApi.groups.update).toHaveBeenCalled());
    expect(screen.getByText('Edit Payroll Group')).toBeInTheDocument();
  });
});

describe('GIVEN the generate-periods dialog', () => {
  /** Opens the dialog and fills the start date; returns nothing. */
  const openAndPickDate = async (date: string) => {
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Generate periods')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Generate periods'));
    await waitFor(() => expect(screen.getByText('Generate Pay Periods')).toBeInTheDocument());
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: date } });
  };

  it('WHEN a start date and count are submitted THEN periods.generate is called for the selected group', async () => {
    mockApi.periods.generate.mockResolvedValue({ data: [], created: 6, skipped: 0 });
    await openAndPickDate('2026-09-01');
    fireEvent.change(screen.getByDisplayValue('12'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(mockApi.periods.generate).toHaveBeenCalledWith({
      payroll_group_id: 'g1', from_month: '2026-09', count: 6,
    }));
    // Periods for the group reload after generation
    await waitFor(() => expect(mockApi.periods.list.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  // The reported bug: the picker's day component was posted verbatim as
  // `from`, so the DTO saw no `from_month` at all and rejected the request.
  it('WHEN a mid-month date like 22-08-2026 is chosen THEN from_month is sent as 2026-08', async () => {
    mockApi.periods.generate.mockResolvedValue({ data: [], created: 10, skipped: 0 });
    await openAndPickDate('2026-08-22');
    fireEvent.change(screen.getByDisplayValue('12'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(mockApi.periods.generate).toHaveBeenCalledWith({
      payroll_group_id: 'g1', from_month: '2026-08', count: 10,
    }));
  });

  it('WHEN the payload is inspected THEN from_month matches the backend YYYY-MM contract and no legacy key rides along', async () => {
    mockApi.periods.generate.mockResolvedValue({ data: [], created: 1, skipped: 0 });
    await openAndPickDate('2026-12-31');
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(mockApi.periods.generate).toHaveBeenCalled());
    const payload = mockApi.periods.generate.mock.calls[0][0];
    // Mirrors GeneratePeriodsDto's @Matches in people-connect-be.
    expect(payload.from_month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    expect(typeof payload.from_month).toBe('string');
    expect(typeof payload.count).toBe('number');
    expect(payload).not.toHaveProperty('from');
    expect(Object.keys(payload).sort()).toEqual(['count', 'from_month', 'payroll_group_id']);
  });

  it('WHEN a date is picked THEN the dialog states which month will be used', async () => {
    await openAndPickDate('2026-08-22');
    expect(screen.getByText(/Periods start from 2026-08/)).toBeInTheDocument();
  });

  it('WHEN months already had periods THEN the toast reports what was actually created, not the requested count', async () => {
    mockApi.periods.generate.mockResolvedValue({ data: [], created: 2, skipped: 4 });
    await openAndPickDate('2026-09-01');
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Generated 2 periods (4 already existed)'));
  });

  it('WHEN every requested month already exists THEN the toast says nothing was added', async () => {
    mockApi.periods.generate.mockResolvedValue({ data: [], created: 0, skipped: 3 });
    await openAndPickDate('2026-09-01');
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('All 3 months already had periods — nothing to add'));
  });

  it('WHEN exactly one period is created THEN the toast is singular', async () => {
    mockApi.periods.generate.mockResolvedValue({ data: [], created: 1, skipped: 0 });
    await openAndPickDate('2026-09-01');
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Generated 1 period'));
  });

  it('WHEN no start date is chosen THEN Generate does nothing', async () => {
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Generate periods')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Generate periods'));
    await waitFor(() => expect(screen.getByText('Generate Pay Periods')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(mockApi.periods.generate).not.toHaveBeenCalled();
  });

  it('WHEN the generate dialog is cancelled THEN it closes without generating', async () => {
    render(<GroupsPeriodsTab />);
    await waitFor(() => expect(screen.getByText('Generate periods')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Generate periods'));
    await waitFor(() => expect(screen.getByText('Generate Pay Periods')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Generate Pay Periods')).not.toBeInTheDocument());
    expect(mockApi.periods.generate).not.toHaveBeenCalled();
  });

  it('WHEN generation fails THEN the dialog stays open', async () => {
    mockApi.periods.generate.mockRejectedValue(new Error('overlap'));
    await openAndPickDate('2026-09-01');
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(mockApi.periods.generate).toHaveBeenCalled());
    expect(screen.getByText('Generate Pay Periods')).toBeInTheDocument();
  });

  // A bare "Failed to generate periods" is what let the from_month bug sit
  // unexplained in the UI — the server's own validation text must reach the user.
  it("WHEN the backend rejects the payload THEN its validation text is shown, not a generic failure", async () => {
    mockApi.periods.generate.mockRejectedValue(new Error('from_month must be YYYY-MM'));
    await openAndPickDate('2026-09-01');
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('from_month must be YYYY-MM'));
  });

  it('WHEN the failure carries no usable message THEN a plain fallback is shown', async () => {
    mockApi.periods.generate.mockRejectedValue({});
    await openAndPickDate('2026-09-01');
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to generate periods'));
  });

  // A date input sanitizes junk to '', so an unnarrowable value reaches submit
  // as empty — the same path the "no start date" case takes. Nothing is posted.
  it('WHEN the picked date cannot be narrowed to a month THEN nothing is posted', async () => {
    await openAndPickDate('not-a-date');
    expect(screen.queryByText(/Periods start from/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(mockApi.periods.generate).not.toHaveBeenCalled();
  });
});
