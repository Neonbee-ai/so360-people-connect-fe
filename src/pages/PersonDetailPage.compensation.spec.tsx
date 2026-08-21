/**
 * PersonDetailPage — compensation privacy tier BDD specs.
 *
 * Rate/compensation surfaces (Cost Rate stat card, Cost/Billing Rate edit
 * inputs, the Rate History tab) must be hidden unless the shell bridge grants
 * `compensation.read`. Fail OPEN while permissions are still loading (no
 * flicker), fail CLOSED once loaded.
 */
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
    linkUser: vi.fn(),
    inviteUser: vi.fn(),
    getOrgRoles: vi.fn().mockResolvedValue({ data: [] }),
    updateSystemRole: vi.fn(),
  },
  allocationsApi: { getAll: vi.fn() },
}));

vi.mock('../services/timesheetApi', () => ({
  timesheetApi: { getEntries: vi.fn() },
}));

vi.mock('../services/goalsService', () => ({
  goalsApi: { getAll: vi.fn() },
  Goal: {},
}));

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  WorkLocation: {},
}));

// Mutable shell-bridge state — each test sets permissionsLoaded/grantedCodes.
const bridgeState: { permissionsLoaded: boolean; grantedCodes: string[] } = {
  permissionsLoaded: true,
  grantedCodes: [],
};

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: bridgeState.permissionsLoaded,
    hasPermission: (code: string) =>
      bridgeState.grantedCodes.includes(code) || bridgeState.grantedCodes.includes('*'),
    hasAnyPermission: () => true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
    currentTenant: { id: 'tenant-1' },
    currentOrg: { id: 'org-1' },
    user: { id: 'u1', email: 'a@b.com' },
    accessToken: 'tok',
  }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
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

import PersonDetailPage from './PersonDetailPage';
import { peopleApi, allocationsApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import { goalsApi } from '../services/goalsService';
import { workLocationsApi } from '../services/workLocationsService';

const mockPeopleApi = peopleApi as any;
const mockAllocApi = allocationsApi as any;
const mockTimeApi = timesheetApi as any;
const mockGoalsApi = goalsApi as any;

const renderPage = (id = 'p1') =>
  render(
    <MemoryRouter initialEntries={[`/people/${id}`]}>
      <Routes>
        <Route path="/people/:id" element={<PersonDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

const mockPerson = {
  id: 'p1',
  full_name: 'Alice Smith',
  email: 'alice@test.com',
  job_title: 'Engineer',
  department: 'Engineering',
  type: 'employee',
  status: 'active',
  cost_rate: 100,
  cost_rate_unit: 'hour',
  billing_rate: 150,
  currency: 'USD',
  available_hours_per_day: 8,
  people_roles: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  bridgeState.permissionsLoaded = true;
  bridgeState.grantedCodes = [];
  mockPeopleApi.getById.mockResolvedValue(mockPerson);
  mockAllocApi.getAll.mockResolvedValue({ data: [] });
  mockTimeApi.getEntries.mockResolvedValue({ data: [] });
  mockGoalsApi.getAll.mockResolvedValue({ data: [] });
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('Given a user WITHOUT compensation.read (permissions loaded)', () => {
  it('When the page loads / Then the Cost Rate stat card is hidden', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.queryByText('Cost Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('$100/hour')).not.toBeInTheDocument();
  });

  it('When the page loads / Then the Rate History tab is not offered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.queryByText('Rate History')).not.toBeInTheDocument();
  });

  it('When editing / Then Cost Rate and Billing Rate inputs are hidden', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    screen.getByText('Edit').click();
    await waitFor(() => expect(screen.getByText('Hours/Day')).toBeInTheDocument());
    expect(screen.queryByText('Cost Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing Rate')).not.toBeInTheDocument();
  });
});

describe('Given a user WITH compensation.read', () => {
  beforeEach(() => {
    bridgeState.grantedCodes = ['compensation.read'];
  });

  it('When the page loads / Then the Cost Rate stat card is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Cost Rate')).toBeInTheDocument();
    expect(screen.getByText('$100/hour')).toBeInTheDocument();
  });

  it('When the page loads / Then the Rate History tab is offered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Rate History')).toBeInTheDocument();
  });
});

describe("Given an Admin holding the '*' wildcard", () => {
  beforeEach(() => {
    bridgeState.grantedCodes = ['*'];
  });

  it('When the page loads / Then compensation surfaces are shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Cost Rate')).toBeInTheDocument();
    expect(screen.getByText('Rate History')).toBeInTheDocument();
  });
});

describe('Given permissions are still loading (permissionsLoaded=false)', () => {
  beforeEach(() => {
    bridgeState.permissionsLoaded = false;
    bridgeState.grantedCodes = [];
  });

  it('When the page loads / Then compensation surfaces fail OPEN (no flicker)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Cost Rate')).toBeInTheDocument();
    expect(screen.getByText('Rate History')).toBeInTheDocument();
  });
});
