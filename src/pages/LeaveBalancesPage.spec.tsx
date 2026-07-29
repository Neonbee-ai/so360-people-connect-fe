import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn() },
}));

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn() },
  LeaveType: {},
}));

vi.mock('../services/leaveRequestsService', () => ({
  leaveBalancesApi: {
    getAll: vi.fn(),
    initialize: vi.fn(),
    adjust: vi.fn(),
  },
  LeaveBalance: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

import LeaveBalancesPage from './LeaveBalancesPage';
import { peopleApi } from '../services/peopleService';
import { leaveTypesApi } from '../services/leaveTypesService';
import { leaveBalancesApi } from '../services/leaveRequestsService';

const mockPeopleApi = peopleApi as any;
const mockLeaveTypesApi = leaveTypesApi as any;
const mockBalancesApi = leaveBalancesApi as any;

const renderPage = () => render(<MemoryRouter><LeaveBalancesPage /></MemoryRouter>);

const person = { id: 'person-1', full_name: 'Alice Johnson' };
const leaveType = {
  id: 'lt1',
  code: 'AL',
  name: 'Annual Leave',
  is_active: true,
  accrual_type: 'annual',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getAll.mockResolvedValue({ data: [person], total: 1 });
  mockLeaveTypesApi.getAll.mockResolvedValue({ data: [leaveType], total: 1 });
  mockBalancesApi.getAll.mockResolvedValue({ data: [] });
});

describe('Given LeaveBalancesPage with no employee selected', () => {
  it('When page loads / Then it prompts to select an employee', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Select an employee')).toBeInTheDocument());
  });
});

describe('Given an employee is selected with no balance initialized yet', () => {
  beforeEach(() => {
    mockBalancesApi.getAll.mockResolvedValue({ data: [] });
  });

  it('When the leave type row renders / Then it shows "Not initialized" instead of a stale zero', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Select an employee...'), { target: { value: 'person-1' } });

    await waitFor(() => expect(screen.getByText('Not initialized')).toBeInTheDocument());
  });

  it('When Initialize Balances is clicked / Then it calls the initialize API for the selected employee/year and reloads', async () => {
    mockBalancesApi.initialize.mockResolvedValue({ message: 'ok' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Select an employee...'), { target: { value: 'person-1' } });
    await waitFor(() => expect(screen.getByText('Not initialized')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Initialize Balances'));

    await waitFor(() => expect(mockBalancesApi.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ person_id: 'person-1' }),
    ));
    await waitFor(() => expect(screen.getByText('Leave balances initialized successfully')).toBeInTheDocument());
  });
});

describe('Given an employee has an existing leave balance', () => {
  beforeEach(() => {
    mockBalancesApi.getAll.mockResolvedValue({
      data: [
        {
          id: 'lb1',
          person_id: 'person-1',
          leave_type_id: 'lt1',
          fiscal_year: new Date().getFullYear(),
          opening_balance: 0,
          accrued: 12,
          used: 4,
          pending: 0,
          adjusted: 0,
          expired: 0,
          available: 8,
        },
      ],
    });
  });

  it('When the row renders / Then it shows the real available balance, not zero', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Select an employee...'), { target: { value: 'person-1' } });

    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
  });

  it('When Adjust is clicked and submitted / Then it calls the adjust API with the entered amount and reason', async () => {
    mockBalancesApi.adjust.mockResolvedValue({});
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Select an employee...'), { target: { value: 'person-1' } });
    await waitFor(() => expect(screen.getByText('Adjust')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Adjust'));
    await waitFor(() => expect(screen.getByText('Adjustment (days) *')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('e.g. 5 to add, -2 to deduct'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Bonus leave for project completion'), { target: { value: 'Bonus' } });

    // Disambiguate from the table row's "Adjust" trigger button, which stays
    // mounted underneath the modal — target the modal's submit button directly.
    const submitButton = container.querySelector('form button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitButton);

    await waitFor(() => expect(mockBalancesApi.adjust).toHaveBeenCalledWith({
      person_id: 'person-1',
      leave_type_id: 'lt1',
      fiscal_year: expect.any(Number),
      adjustment_amount: 5,
      reason: 'Bonus',
    }));
  });
});
