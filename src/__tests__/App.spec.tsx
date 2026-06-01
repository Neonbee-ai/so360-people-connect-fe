import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/peopleService', () => ({
  peopleService: {
    setTenantId: vi.fn(),
    setOrgId: vi.fn(),
    setAccessToken: vi.fn(),
    setUser: vi.fn(),
  },
  utilizationApi: { getSummary: vi.fn().mockResolvedValue({ total_people: 0, avg_utilization_pct: 0, total_hours_this_week: 0, total_cost_this_week: 0, active_allocations: 0, pending_approvals: 0, burn_rate_daily: 0 }) },
  timeEntriesApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  eventsApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));

let mockShellData: any = {
  currentTenant: null,
  currentOrg: null,
  accessToken: null,
  user: null,
};

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => mockShellData,
  ShellContext: { Provider: ({ children }: any) => children },
  useActivity: () => ({ recordActivity: async () => {} }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { currency: 'USD', timezone: 'UTC' } }),
}));

import App from '../App';
import { peopleService, utilizationApi, timeEntriesApi, eventsApi } from '../services/peopleService';

const mockService = peopleService as any;

beforeEach(() => {
  vi.resetAllMocks();
  mockShellData = {
    currentTenant: null,
    currentOrg: null,
    accessToken: null,
    user: null,
  };
  // Re-set mocks wiped by vi.resetAllMocks() so DashboardPage doesn't crash
  (utilizationApi as any).getSummary.mockResolvedValue({ total_people: 0, avg_utilization_pct: 0, total_hours_this_week: 0, total_cost_this_week: 0, active_allocations: 0, pending_approvals: 0, burn_rate_daily: 0 });
  (timeEntriesApi as any).getAll.mockResolvedValue({ data: [] });
  (eventsApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('App', () => {
  describe('Given shell context is not ready', () => {
    it('When currentTenant and currentOrg are missing / Then it shows connecting message', () => {
      render(<MemoryRouter><App /></MemoryRouter>);
      expect(screen.getByText('Connecting to shell context...')).toBeInTheDocument();
    });
  });

  describe('Given shell context is ready', () => {
    beforeEach(() => {
      mockShellData = {
        currentTenant: { id: 't1', name: 'Tenant' },
        currentOrg: { id: 'o1', name: 'Org' },
        accessToken: 'tok',
        user: { id: 'u1', email: 'test@test.com', full_name: 'Test User' },
      };
    });

    it('When navigating to / / Then it redirects to dashboard', async () => {
      render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
      await waitFor(() => expect(screen.getByText('People Connect')).toBeInTheDocument(), { timeout: 5000 });
    });

    it('When context syncs / Then it sets context on peopleService', async () => {
      render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(mockService.setTenantId).toHaveBeenCalledWith('t1');
        expect(mockService.setOrgId).toHaveBeenCalledWith('o1');
        expect(mockService.setAccessToken).toHaveBeenCalledWith('tok');
      });
    });
  });
});
