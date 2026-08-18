import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getMe: vi.fn().mockResolvedValue({ id: 'p1', full_name: 'Test User' }),
    getAll: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  },
}));

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    submit: vi.fn(),
    delete: vi.fn(),
    getBalances: vi.fn(),
  },
  LeaveRequest: {},
  CreateLeaveRequestPayload: {},
}));

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

vi.mock('../hooks/useShellContext', () => ({
  usePeopleContext: () => ({ orgId: 'o1', tenantId: 't1', userId: 'u1' }),
}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

import LeaveRequestsPage from './LeaveRequestsPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { leaveTypesApi } from '../services/leaveTypesService';
import { todayIso } from '../utils/validation';
import { peopleApi } from '../services/peopleService';

const mockPeopleApi = peopleApi as any;
const mockLeaveApi = leaveRequestsApi as any;
const mockTypesApi = leaveTypesApi as any;

const ANNUAL = { id: 'lt1', name: 'Annual Leave', code: 'AL', is_active: true, allow_backdated_requests: false };
const SICK = { id: 'lt2', name: 'Sick Leave', code: 'SL', is_active: true, allow_backdated_requests: true };

const today = todayIso();
const plusDays = (days: number) => {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const startDate = () => screen.getByLabelText('Start Date *') as HTMLInputElement;
const endDate = () => screen.getByLabelText('End Date *') as HTMLInputElement;
const submit = () => screen.getByRole('button', { name: 'Submit Request' });

const openModal = async () => {
  render(<MemoryRouter><LeaveRequestsPage /></MemoryRouter>);
  // Both the page header and the empty state offer "Request Leave".
  await waitFor(() => expect(screen.getAllByRole('button', { name: /request leave/i }).length).toBeGreaterThan(0));
  fireEvent.click(screen.getAllByRole('button', { name: /request leave/i })[0]);
  await waitFor(() => expect(screen.getByLabelText('Start Date *')).toBeInTheDocument());
};

/** Fill in everything except the dates, so only the dates decide validity. */
const fillRequiredFields = async (leaveTypeId = ANNUAL.id) => {
  await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Leave Type *'), { target: { value: leaveTypeId } });
  fireEvent.change(screen.getByLabelText('Reason *'), { target: { value: 'Family trip' } });
};

beforeEach(() => {
  vi.resetAllMocks();
  // resetAllMocks also clears implementations declared in the vi.mock factory,
  // so the logged-in person must be re-stubbed here or the form self-disables.
  mockPeopleApi.getMe.mockResolvedValue({ id: 'p1', full_name: 'Test User' });
  mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
  mockLeaveApi.getBalances.mockResolvedValue({ data: [] });
  mockLeaveApi.create.mockResolvedValue({ id: 'lr-new' });
  mockLeaveApi.submit.mockResolvedValue({});
  mockTypesApi.getAll.mockResolvedValue({ data: [ANNUAL, SICK] });
});

afterEach(() => vi.useRealTimers());

describe('Given the Request Leave date fields', () => {
  it('When the modal opens / Then the start date cannot be picked before today', async () => {
    await openModal();
    expect(startDate()).toHaveAttribute('min', today);
  });

  it('When a past start date is typed / Then an inline error appears and submit is blocked', async () => {
    await openModal();
    await fillRequiredFields();

    fireEvent.change(startDate(), { target: { value: '2025-01-05' } });

    expect(await screen.findByText('Start date cannot be in the past.')).toBeInTheDocument();
    expect(submit()).toBeDisabled();

    fireEvent.click(submit());
    expect(mockLeaveApi.create).not.toHaveBeenCalled();
  });

  it('When a leave type allows backdating / Then a past start date is accepted', async () => {
    await openModal();
    await fillRequiredFields(SICK.id);

    fireEvent.change(startDate(), { target: { value: '2025-01-05' } });

    await waitFor(() => expect(screen.queryByText('Start date cannot be in the past.')).not.toBeInTheDocument());
    expect(startDate()).not.toHaveAttribute('min', today);
  });

  it('When an end date earlier than the start date is typed / Then an inline error appears and submit is blocked', async () => {
    await openModal();
    await fillRequiredFields();

    fireEvent.change(startDate(), { target: { value: plusDays(5) } });
    fireEvent.change(endDate(), { target: { value: plusDays(1) } });

    expect(await screen.findByText('End date cannot be earlier than start date.')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it('When the end date is invalid / Then Total Days shows a dash instead of a bogus figure', async () => {
    await openModal();
    await fillRequiredFields();

    fireEvent.change(startDate(), { target: { value: plusDays(5) } });
    fireEvent.change(endDate(), { target: { value: plusDays(1) } });

    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument());
    expect(screen.getByText('Fix the dates above to see the total.')).toBeInTheDocument();
  });

  it('When the start date is moved past the end date / Then the end date follows it instead of going invalid', async () => {
    await openModal();
    await fillRequiredFields();

    fireEvent.change(startDate(), { target: { value: plusDays(10) } });

    await waitFor(() => expect(endDate().value).toBe(plusDays(10)));
    expect(endDate()).toHaveAttribute('min', plusDays(10));
  });

  it('When a same-day request is made / Then it is valid and submits', async () => {
    await openModal();
    await fillRequiredFields();

    fireEvent.change(startDate(), { target: { value: today } });
    fireEvent.change(endDate(), { target: { value: today } });

    expect(submit()).not.toBeDisabled();
    fireEvent.click(submit());

    await waitFor(() => expect(mockLeaveApi.create).toHaveBeenCalled());
    expect(mockLeaveApi.create.mock.calls[0][0]).toMatchObject({ start_date: today, end_date: today });
  });

  it('When a month-end / leap-year window is chosen / Then the day count is exact', async () => {
    await openModal();
    await fillRequiredFields(SICK.id); // backdating allowed, so fixed dates are usable

    fireEvent.change(startDate(), { target: { value: '2028-02-27' } });
    fireEvent.change(endDate(), { target: { value: '2028-03-01' } });

    // 27, 28, 29 (leap day), 1 March = 4 days
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
  });

  it('When the reason is left empty / Then submit stays disabled', async () => {
    await openModal();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Leave Type *'), { target: { value: ANNUAL.id } });

    expect(submit()).toBeDisabled();
  });
});

describe('Given the half-day options on the Request Leave form', () => {
  it('When the request spans one day / Then only a single, self-explanatory half-day option is shown', async () => {
    await openModal();
    await fillRequiredFields();

    expect(screen.getByText('Half Day (this day only)')).toBeInTheDocument();
    expect(screen.queryByText('End Date – Half Day')).not.toBeInTheDocument();
  });

  it('When the request spans multiple days / Then each checkbox is labelled with the date it belongs to', async () => {
    await openModal();
    await fillRequiredFields();

    fireEvent.change(endDate(), { target: { value: plusDays(3) } });

    expect(await screen.findByText('Start Date – Half Day')).toBeInTheDocument();
    expect(screen.getByText('End Date – Half Day')).toBeInTheDocument();
  });

  it('When the start half-day is ticked on a multi-day request / Then Total Days drops by exactly half a day', async () => {
    await openModal();
    await fillRequiredFields();

    fireEvent.change(endDate(), { target: { value: plusDays(2) } });
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Start Date – Half Day'));
    await waitFor(() => expect(screen.getByText('2.5')).toBeInTheDocument());
  });

  it('When both half-days are ticked on a multi-day request / Then Total Days drops by one full day', async () => {
    await openModal();
    await fillRequiredFields();

    fireEvent.change(endDate(), { target: { value: plusDays(2) } });
    fireEvent.click(screen.getByLabelText('Start Date – Half Day'));
    fireEvent.click(screen.getByLabelText('End Date – Half Day'));

    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });

  it('When a multi-day end half-day is ticked and the range collapses to one day / Then it is dropped from the payload', async () => {
    await openModal();
    await fillRequiredFields();

    fireEvent.change(endDate(), { target: { value: plusDays(2) } });
    fireEvent.click(screen.getByLabelText('End Date – Half Day'));
    fireEvent.change(endDate(), { target: { value: today } });

    fireEvent.click(submit());
    await waitFor(() => expect(mockLeaveApi.create).toHaveBeenCalled());
    expect(mockLeaveApi.create.mock.calls[0][0].is_half_day_end).toBe(false);
  });

  it('When the form is shown / Then helper text explains what each half-day option means', async () => {
    await openModal();
    expect(screen.getByText(/applies only to its own date/i)).toBeInTheDocument();
  });
});
