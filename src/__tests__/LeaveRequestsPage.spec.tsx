import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getAll: vi.fn(), create: vi.fn(), submit: vi.fn(), getBalances: vi.fn() },
  LeaveRequest: {},
  CreateLeaveRequestPayload: {},
  LeaveBalance: {},
}));

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn() },
  LeaveType: {},
}));

vi.mock('../services/apiClient', () => ({
  apiContext: { getUserId: () => 'u1' },
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: { getMe: vi.fn().mockResolvedValue({ id: 'person-1', full_name: 'Alice' }) },
}));


let mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ ...mockShellFlags, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

import LeaveRequestsPage from '../pages/LeaveRequestsPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { leaveTypesApi } from '../services/leaveTypesService';
import { peopleApi } from '../services/peopleService';

const mockApi = leaveRequestsApi as any;
const mockLeaveTypesApi = leaveTypesApi as any;
const mockPeopleApi = peopleApi as any;

const renderPage = () => render(<MemoryRouter><LeaveRequestsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
  // Re-initialize leave types and people mocks after vi.resetAllMocks() so the
  // modal doesn't get undefined.data when it calls leaveTypesApi.getAll().
  mockLeaveTypesApi.getAll.mockResolvedValue({ data: [] });
  mockApi.getBalances.mockResolvedValue({ data: [] });
  mockPeopleApi.getMe.mockResolvedValue({ id: 'person-1', full_name: 'Alice' });
});

describe('LeaveRequestsPage', () => {
  describe('Given leave requests exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          {
            id: 'lr1', person_id: 'p1', leave_type_id: 'lt1', start_date: '2025-06-01',
            end_date: '2025-06-03', is_half_day_start: false, is_half_day_end: true,
            total_days: 2.5, status: 'pending', submitted_at: '2025-05-28',
            person: { id: 'p1', full_name: 'Alice', avatar_url: null },
            leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL', color: '#10b981' },
          },
        ],
      });
    });

    it('When the page loads / Then it renders the requests table', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      expect(screen.getByText('Annual Leave')).toBeInTheDocument();
      expect(screen.getByText('2.5')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows tabs for My and Team requests', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('My Requests')).toBeInTheDocument());
      expect(screen.getByText('Team Requests')).toBeInTheDocument();
    });

    it('When Request Leave is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      fireEvent.click(screen.getAllByText('Request Leave')[0]);
      await waitFor(() => expect(screen.getByText('Leave Type *')).toBeInTheDocument());
    });
  });

  describe('Given no leave requests exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No leave requests found')).toBeInTheDocument());
    });
  });
});

describe('LeaveRequestsPage — effectiveFlagsLoaded gate', () => {
  it('When effectiveFlagsLoaded is false / Then Request Leave button is absent', async () => {
    mockShellFlags = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
    mockApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No leave requests found')).toBeInTheDocument());
    expect(screen.queryByText('Request Leave')).not.toBeInTheDocument();
  });

  it('When effectiveFlagsLoaded is true / Then Request Leave button is present', async () => {
    mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
    mockApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No leave requests found')).toBeInTheDocument());
    expect(screen.queryAllByText('Request Leave').length).toBeGreaterThan(0);
  });
});
