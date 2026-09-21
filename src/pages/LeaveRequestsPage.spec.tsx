import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: { getMe: vi.fn().mockResolvedValue({ id: 'p1', full_name: 'Test User' }), getAll: vi.fn().mockResolvedValue({ data: [], total: 0 }) },
}));

// Closed-list stub: any method the page calls but this object omits comes back
// undefined and fails an unrelated assertion. getById (view modal) and
// getEligibleApprovers (approver picker) must stay listed here.
vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: {
    getAll: vi.fn(),
    getById: vi.fn().mockResolvedValue({ id: 'lr1', approvals: [] }),
    create: vi.fn(),
    submit: vi.fn(),
    delete: vi.fn(),
    getBalances: vi.fn(),
    getEligibleApprovers: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      suggested_approver_id: null,
    }),
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
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

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
    formatDate: (d: string, _opts?: any) => d ?? '',
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
import { peopleApi } from '../services/peopleService';
import { toast } from '@so360/design-system';

const mockLeaveApi = leaveRequestsApi as any;
const mockTypesApi = leaveTypesApi as any;

const renderPage = () => render(<MemoryRouter><LeaveRequestsPage /></MemoryRouter>);

const mockRequest = {
  id: 'lr1',
  person: { id: 'p1', full_name: 'Alice', email: 'alice@test.com' },
  leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL', color: '#10B981' },
  start_date: '2024-07-01',
  end_date: '2024-07-05',
  total_days: 5,
  status: 'draft',
  reason: 'Family vacation',
  created_at: '2024-06-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockTypesApi.getAll.mockResolvedValue({ data: [] });
  // The request picker now loads the types APPLICABLE to the employee, not the
  // org-wide catalog — the catalog offered everyone every type.
  (leaveConfigApi as any).getApplicable.mockResolvedValue({ leave_types: [] });
  mockLeaveApi.getBalances.mockResolvedValue({ data: [] });
  // resetAllMocks() above wipes the factory defaults, so the approver picker and
  // the detail fetch must be re-stubbed here or every render rejects on undefined.
  mockLeaveApi.getEligibleApprovers.mockResolvedValue({
    data: [],
    total: 0,
    suggested_approver_id: null,
  });
  mockLeaveApi.getById.mockResolvedValue({ ...mockRequest, approvals: [] });
  // Same reason: the approver selector only renders once the modal has resolved
  // the current person, so a wiped getMe silently removes the whole field.
  (peopleApi.getMe as any).mockResolvedValue({ id: 'p1', full_name: 'Test User' });
});

describe('Given an employee filling in the Request Leave modal', () => {
  const APPLICABLE = {
    leave_types: [{ id: 'lt1', name: 'Annual Leave', code: 'AL', is_active: true }],
  };

  const openModal = async () => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
    (leaveConfigApi as any).getApplicable.mockResolvedValue(APPLICABLE);
    mockLeaveApi.getEligibleApprovers.mockResolvedValue({
      data: [
        { id: 'mgr-1', full_name: 'Raj Kumar', job_title: 'Sales Manager', department_name: 'Sales', is_suggested: true, is_department_head: true },
        { id: 'hr-1', full_name: 'Priya Sharma', job_title: 'HR Manager', department_name: 'People', is_suggested: false, is_department_head: true },
      ],
      total: 2,
      suggested_approver_id: 'mgr-1',
    });
    mockLeaveApi.create.mockResolvedValue({ id: 'new-lr' });
    mockLeaveApi.submit.mockResolvedValue({ id: 'new-lr', status: 'pending' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Leave Requests')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /request leave/i })[0]);
    await waitFor(() => expect(screen.getByText(/Send Request To/i)).toBeInTheDocument());
  };

  const fillRequiredFields = () => {
    fireEvent.change(screen.getByLabelText(/Leave Type/i), { target: { value: 'lt1' } });
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'Personal leave' } });
  };

  it('When the modal opens / Then an approver field is present', async () => {
    await openModal();
    expect(screen.getByText(/Send Request To/i)).toBeInTheDocument();
  });

  it('When approvers are loaded / Then People Connect employees are offered with title and department', async () => {
    await openModal();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Raj Kumar/ })).toBeInTheDocument());
    expect(screen.getByText(/Sales Manager · Sales/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Priya Sharma/ })).toBeInTheDocument();
  });

  it('When a reporting manager is suggested / Then it is preselected and submitted without being clicked', async () => {
    await openModal();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Raj Kumar/ })).toBeInTheDocument());

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => expect(mockLeaveApi.submit).toHaveBeenCalledWith('new-lr', ['mgr-1']));
  });

  it('When a second approver is added / Then BOTH ids are sent on submit', async () => {
    await openModal();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Priya Sharma/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Priya Sharma/ }));
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => expect(mockLeaveApi.submit).toHaveBeenCalledWith('new-lr', ['mgr-1', 'hr-1']));
  });

  it('When a selected approver is removed / Then their id is not submitted', async () => {
    await openModal();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Raj Kumar/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Remove Raj Kumar/i }));
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => expect(mockLeaveApi.submit).toHaveBeenCalledWith('new-lr', []));
  });

  it('When the same approver is clicked twice / Then no duplicate id is submitted', async () => {
    await openModal();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Priya Sharma/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Priya Sharma/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Priya Sharma/ }));
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => expect(mockLeaveApi.submit).toHaveBeenCalledWith('new-lr', ['mgr-1']));
  });

  it('When the approver list fails to load / Then an error with a retry is shown instead of a silent empty list', async () => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
    (leaveConfigApi as any).getApplicable.mockResolvedValue(APPLICABLE);
    mockLeaveApi.getEligibleApprovers.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Leave Requests')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /request leave/i })[0]);

    await waitFor(() =>
      expect(screen.getByText(/Unable to load approvers/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('Given LeaveRequestsPage loads with requests', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [mockRequest], total: 1 });
  });

  it('When page loads / Then "Leave Requests" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Leave Requests')).toBeInTheDocument());
  });

  it('When requests are fetched / Then leave type name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
  });

  it('When requests are fetched / Then the status badge is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Draft')).toBeInTheDocument());
  });
});

describe('Given LeaveRequestsPage with no requests', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no leave requests exist / Then empty state is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No leave requests/i)).toBeInTheDocument());
  });
});

describe('Given LeaveRequestsPage status filter', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [mockRequest], total: 1 });
  });

  it('When status filter changes / Then API is called with new status', async () => {
    renderPage();
    await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'approved' } });
    await waitFor(() =>
      expect(mockLeaveApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }))
    );
  });
});

describe('Given LeaveRequestsPage tab bar removal', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockResolvedValue({ data: [mockRequest], total: 1 });
  });

  it('When page loads / Then Team Requests tab is not rendered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    expect(screen.queryByText('Team Requests')).not.toBeInTheDocument();
  });

  it('When page loads / Then My Requests tab button is not rendered (tab bar removed)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'My Requests' })).not.toBeInTheDocument();
  });

  it('When page loads / Then page heading is still visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Leave Requests')).toBeInTheDocument());
  });

  it('When page loads / Then status filter is still present', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument());
  });
});

describe('Given LeaveRequestsPage API failure', () => {
  beforeEach(() => {
    mockLeaveApi.getAll.mockImplementation(async () => { throw new Error('Server error'); });
  });

  it('When API fails / Then error toast is shown', async () => {
    const toastErrorSpy = vi.spyOn(toast, 'error');
    renderPage();
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalledWith('Failed to load leave requests'));
  });
});
