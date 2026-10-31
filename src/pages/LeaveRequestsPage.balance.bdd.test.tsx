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
    getById: vi.fn().mockResolvedValue({ id: 'lr1', approvals: [] }),
    getEligibleApprovers: vi.fn().mockResolvedValue({ data: [], total: 0, suggested_approver_id: null }),
  },
  LeaveRequest: {},
  CreateLeaveRequestPayload: {},
}));

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn() },
}));

vi.mock('../services/leaveConfigService', () => ({
  leaveConfigApi: { getApplicable: vi.fn() },
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
    // Date-only primitives — this factory is a CLOSED LIST, so a component that
    // adopts formatters.businessToday()/toBusinessDate() throws here otherwise.
    toBusinessDate: (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)),
    businessToday: () => '2026-09-15',
    startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`),
    endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
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
import { leaveConfigApi } from '../services/leaveConfigService';
import { todayIso } from '../utils/validation';
import { peopleApi } from '../services/peopleService';

const mockPeopleApi = peopleApi as any;
const mockLeaveApi = leaveRequestsApi as any;
const mockTypesApi = leaveTypesApi as any;

const ANNUAL = { id: 'lt1', name: 'Annual Leave', code: 'AL', is_active: true, allow_backdated_requests: false, accrual_type: 'annual' };
const SICK = { id: 'lt2', name: 'Sick Leave', code: 'SL', is_active: true, allow_backdated_requests: true, accrual_type: 'none' };

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
  mockLeaveApi.getBalances.mockResolvedValue({ data: [
    { leave_type_id: 'lt1', opening_balance: 2, accrued: 0, adjusted: 0, used: 0, available: 2 },
    { leave_type_id: 'lt2', opening_balance: 0, accrued: 0, adjusted: 0, used: 0, available: 0 },
  ] });
  mockLeaveApi.create.mockResolvedValue({ id: 'lr-new' });
  mockLeaveApi.submit.mockResolvedValue({});
  mockTypesApi.getAll.mockResolvedValue({ data: [ANNUAL, SICK] });
  // The request picker now loads the types APPLICABLE to the employee, not the
  // org-wide catalog — the catalog offered everyone every type.
  (leaveConfigApi as any).getApplicable.mockResolvedValue({ leave_types: [ANNUAL, SICK] });
});

afterEach(() => vi.useRealTimers());

describe('Given a leave type with 2 available days (Pulse dfb287a2)', () => {
  it('When 5 days are requested / Then an inline warning shows and Submit is disabled', async () => {
    await openModal();
    await fillRequiredFields(ANNUAL.id);
    fireEvent.change(startDate(), { target: { value: plusDays(1) } });
    fireEvent.change(endDate(), { target: { value: plusDays(5) } });
    await waitFor(() => expect(screen.getByText(/only 2 are available/i)).toBeInTheDocument());
    expect(submit()).toBeDisabled();
  });

  it('When 2 days are requested / Then no warning and Submit is enabled', async () => {
    await openModal();
    await fillRequiredFields(ANNUAL.id);
    fireEvent.change(startDate(), { target: { value: plusDays(1) } });
    fireEvent.change(endDate(), { target: { value: plusDays(2) } });
    await waitFor(() => expect(submit()).toBeEnabled());
    expect(screen.queryByText(/are available/i)).not.toBeInTheDocument();
  });

  it('When the leave type has accrual_type none / Then an over-balance request is not blocked', async () => {
    await openModal();
    await fillRequiredFields(SICK.id);
    fireEvent.change(startDate(), { target: { value: plusDays(1) } });
    fireEvent.change(endDate(), { target: { value: plusDays(5) } });
    await waitFor(() => expect(submit()).toBeEnabled());
    expect(screen.queryByText(/are available/i)).not.toBeInTheDocument();
  });
});
