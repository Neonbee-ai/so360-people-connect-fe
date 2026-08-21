import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

const person = {
  id: 'p1',
  full_name: 'Alice Smith',
  email: 'alice@test.com',
  job_title: 'Engineer',
  type: 'employee',
  status: 'active',
  cost_rate: 100,
  cost_rate_unit: 'hour',
  currency: 'USD',
  available_hours_per_day: 8,
  available_days_per_week: 5,
  people_roles: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const existingRateEvent = {
  id: 'rh-1',
  new_cost_rate: 100,
  new_billing_rate: 150,
  effective_date: '2026-01-01',
  reason: 'Initial rate',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/people/p1']}>
      <Routes>
        <Route path="/people/:id" element={<PersonDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

const openRateHistoryTab = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Rate History')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Rate History'));
  await waitFor(() => expect(screen.getByText('Add New Rate')).toBeInTheDocument());
};

const openAddRateModal = async () => {
  await openRateHistoryTab();
  fireEvent.click(screen.getByText('Add New Rate'));
  await waitFor(() => expect(screen.getByText('Add Rate')).toBeInTheDocument());
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getById.mockResolvedValue(person);
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockPeopleApi.getRateHistory.mockResolvedValue([existingRateEvent]);
  (allocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (timesheetApi as any).getEntries.mockResolvedValue({ data: [] });
  (goalsApi as any).getAll.mockResolvedValue({ data: [] });
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('Given the Rate History tab', () => {
  it('When it loads / Then history rows are rendered read-only, with rate management kept as a single separate action', async () => {
    await openRateHistoryTab();
    expect(screen.getByText('Initial rate')).toBeInTheDocument();
    // Exactly one rate-management control on the page (the Add New Rate action) —
    // no per-row edit/update affordance on the read-only history entries.
    expect(screen.getAllByText('Add New Rate')).toHaveLength(1);
  });

  it('When Add New Rate is clicked / Then the create-new-rate dialog opens instead of doing nothing', async () => {
    await openAddRateModal();
    expect(screen.getByText(/Records a new effective-dated rate/)).toBeInTheDocument();
  });
});

describe('Given the Add New Rate dialog', () => {
  it('When no cost rate is entered / Then submit is rejected with a validation error', async () => {
    await openAddRateModal();
    fireEvent.click(screen.getByRole('button', { name: 'Add Rate' }));
    expect(await screen.findByText('Enter a valid cost rate.')).toBeInTheDocument();
    expect(mockPeopleApi.updateRate).not.toHaveBeenCalled();
  });

  it('When a valid cost rate is submitted / Then it creates a new rate record via the API', async () => {
    mockPeopleApi.updateRate.mockResolvedValue({ id: 'rh-2' });
    await openAddRateModal();

    fireEvent.change(screen.getByLabelText('Cost Rate *'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Rate' }));

    await waitFor(() =>
      expect(mockPeopleApi.updateRate).toHaveBeenCalledWith('p1', {
        cost_rate: 120,
        billing_rate: undefined,
        effective_date: undefined,
        reason: undefined,
      })
    );
  });

  it('When the new rate is saved / Then only the create-rate endpoint is called — no edit/update call on the existing history record', async () => {
    mockPeopleApi.updateRate.mockResolvedValue({ id: 'rh-2' });
    await openAddRateModal();

    fireEvent.change(screen.getByLabelText('Cost Rate *'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Rate' }));

    await waitFor(() => expect(mockPeopleApi.updateRate).toHaveBeenCalledTimes(1));
    expect(mockPeopleApi.update).not.toHaveBeenCalled();
    // History reloads from the server rather than being mutated in place.
    await waitFor(() => expect(mockPeopleApi.getRateHistory).toHaveBeenCalledTimes(2));
  });

  it('When the save call fails / Then the error is shown in the dialog rather than failing silently', async () => {
    mockPeopleApi.updateRate.mockRejectedValue(new Error('Rate update rejected'));
    await openAddRateModal();

    fireEvent.change(screen.getByLabelText('Cost Rate *'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Rate' }));

    expect(await screen.findByText('Rate update rejected')).toBeInTheDocument();
    expect(screen.getByText(/Records a new effective-dated rate/)).toBeInTheDocument();
  });
});
