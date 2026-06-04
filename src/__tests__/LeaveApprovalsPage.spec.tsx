import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getPendingApprovals: vi.fn(), approve: vi.fn(), reject: vi.fn() },
  LeaveRequest: {},
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

import LeaveApprovalsPage from '../pages/LeaveApprovalsPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';

const mockApi = leaveRequestsApi as any;

const renderPage = () => render(<MemoryRouter><LeaveApprovalsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
});

describe('LeaveApprovalsPage', () => {
  describe('Given pending approvals exist', () => {
    beforeEach(() => {
      mockApi.getPendingApprovals.mockResolvedValue({
        data: [
          {
            id: 'lr1', person_id: 'p1', start_date: '2025-06-01', end_date: '2025-06-05',
            total_days: 5, submitted_at: '2025-05-28',
            person: { id: 'p1', full_name: 'Alice Smith', email: 'alice@test.com', avatar_url: null },
            leave_type: { id: 'lt1', name: 'Annual Leave', color: '#10b981' },
          },
        ],
      });
    });

    it('When the page loads / Then it renders the approvals table', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      expect(screen.getByText('Annual Leave')).toBeInTheDocument();
    });

    it('When Reject is clicked / Then the reject modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Reject')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Reject'));
      await waitFor(() => expect(screen.getByText('Reject Leave Request')).toBeInTheDocument());
    });
  });

  describe('Given no pending approvals', () => {
    beforeEach(() => {
      mockApi.getPendingApprovals.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No pending approvals')).toBeInTheDocument());
    });
  });
});

describe('LeaveApprovalsPage — effectiveFlagsLoaded gate', () => {
  it('When effectiveFlagsLoaded is false / Then Approve button is absent', async () => {
    mockShellFlags = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
    mockApi.getPendingApprovals.mockResolvedValue({
      data: [{
        id: 'lr1', start_date: '2025-06-01', end_date: '2025-06-05', total_days: 5, submitted_at: '2025-05-28',
        person: { full_name: 'Alice Smith', email: 'alice@test.com', avatar_url: null },
        leave_type: { name: 'Annual Leave', color: '#10b981' },
      }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
  });

  it('When effectiveFlagsLoaded is true / Then Approve button is present', async () => {
    mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
    mockApi.getPendingApprovals.mockResolvedValue({
      data: [{
        id: 'lr1', start_date: '2025-06-01', end_date: '2025-06-05', total_days: 5, submitted_at: '2025-05-28',
        person: { full_name: 'Alice Smith', email: 'alice@test.com', avatar_url: null },
        leave_type: { name: 'Annual Leave', color: '#10b981' },
      }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Approve')).toBeInTheDocument();
  });
});
