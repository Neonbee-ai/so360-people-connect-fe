import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getById: vi.fn(),
    update: vi.fn(),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    getEmploymentHistory: vi.fn(),
    getRateHistory: vi.fn(),
    updateRate: vi.fn(),
    linkUser: vi.fn(),
    inviteUser: vi.fn(),
    getOrgRoles: vi.fn(),
    updateSystemRole: vi.fn(),
  },
  allocationsApi: { getAll: vi.fn() },
}));

vi.mock('../services/timesheetApi', () => ({ timesheetApi: { getEntries: vi.fn() } }));
vi.mock('../services/goalsService', () => ({ goalsApi: { getAll: vi.fn() }, Goal: {} }));
vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn() },
  WorkLocation: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
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

vi.mock('../components/payroll/PayrollProfileTab', () => ({ default: ({ person }: any) => <div data-testid="payroll-tab">payroll for {person.full_name}</div> }));
vi.mock('../components/leave/PersonLeaveConfigTab', () => ({ default: ({ personId }: any) => <div data-testid="leave-tab">leave for {personId}</div> }));
vi.mock('../components/PersonOnboardingTab', () => ({ default: ({ personId }: any) => <div data-testid="onboarding-tab">onboarding for {personId}</div> }));

import PersonDetailPage from './PersonDetailPage';
import { peopleApi, allocationsApi } from '../services/peopleService';
import { goalsApi } from '../services/goalsService';
import { workLocationsApi } from '../services/workLocationsService';

const person = {
  id: 'p1', full_name: 'Alice Smith', email: 'alice@test.com', job_title: 'Engineer', type: 'employee', status: 'active',
  cost_rate: 100, cost_rate_unit: 'hour', currency: 'USD', available_hours_per_day: 8, available_days_per_week: 5,
  people_roles: [], created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};

const renderAt = (tab: string) =>
  render(
    <MemoryRouter initialEntries={[`/people/p1?tab=${tab}`]}>
      <Routes>
        <Route path="/people/:id" element={<PersonDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const api = peopleApi as any;
  api.getById.mockResolvedValue(person);
  api.getOrgRoles.mockResolvedValue({ data: [] });
  api.getRateHistory.mockResolvedValue([]);
  api.getEmploymentHistory.mockResolvedValue([]);
  (allocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (goalsApi as any).getAll.mockResolvedValue({ data: [] });
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('PersonDetailPage lazy tabs', () => {
  describe('Given the payroll tab is requested', () => {
    it('When the person loads / Then the lazily loaded PayrollProfileTab renders for that person', async () => {
      renderAt('payroll');
      expect(await screen.findByTestId('payroll-tab')).toHaveTextContent('payroll for Alice Smith');
    });
  });

  describe('Given the leave tab is requested', () => {
    it('When the page loads / Then PersonLeaveConfigTab renders with the route person id', async () => {
      renderAt('leave');
      expect(await screen.findByTestId('leave-tab')).toHaveTextContent('leave for p1');
    });
  });

  describe('Given the onboarding tab is requested', () => {
    it('When the page loads / Then PersonOnboardingTab renders with the route person id', async () => {
      renderAt('onboarding');
      expect(await screen.findByTestId('onboarding-tab')).toHaveTextContent('onboarding for p1');
    });
  });

  describe('Given the default overview tab', () => {
    it('When the page loads / Then none of the heavy tabs is mounted', async () => {
      renderAt('overview');
      await waitFor(() => expect((peopleApi as any).getById).toHaveBeenCalled());
      expect((await screen.findAllByText('Alice Smith')).length).toBeGreaterThan(0);
      expect(screen.queryByTestId('payroll-tab')).not.toBeInTheDocument();
      expect(screen.queryByTestId('leave-tab')).not.toBeInTheDocument();
      expect(screen.queryByTestId('onboarding-tab')).not.toBeInTheDocument();
    });
  });
});
