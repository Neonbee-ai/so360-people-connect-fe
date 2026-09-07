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
const mockTimesheetApi = timesheetApi as any;

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

const timeEntry = {
  id: 'te-1',
  entity_name: 'Apollo Project',
  entity_type: 'project',
  entry_date: '2026-02-01',
  description: 'Sprint work',
  hours: 6,
  calculated_cost: 600,
  status: 'approved',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/people/p1']}>
      <Routes>
        <Route path="/people/:id" element={<PersonDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

const openTimeTab = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Time Entries')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Time Entries'));
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  mockPeopleApi.getById.mockResolvedValue(person);
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockPeopleApi.getRateHistory.mockResolvedValue([]);
  mockPeopleApi.getEmploymentHistory.mockResolvedValue([]);
  (allocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (goalsApi as any).getAll.mockResolvedValue({ data: [] });
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
  mockTimesheetApi.getEntries.mockResolvedValue({ data: [] });
});

describe('Given the timesheet bridge returns no rows for this person', () => {
  it('When the Time Entries tab is opened / Then the genuinely-empty state is shown', async () => {
    mockTimesheetApi.getEntries.mockResolvedValue({ data: [] });
    await openTimeTab();

    expect(await screen.findByText('No time entries')).toBeInTheDocument();
    expect(
      screen.getByText('Time entries logged by this person will appear here')
    ).toBeInTheDocument();
    expect(screen.queryByText('Unable to load time entries')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('When rows do exist / Then they are rendered instead of any empty or error state', async () => {
    mockTimesheetApi.getEntries.mockResolvedValue({ data: [timeEntry] });
    await openTimeTab();

    expect(await screen.findByText('Apollo Project')).toBeInTheDocument();
    expect(screen.queryByText('No time entries')).not.toBeInTheDocument();
    expect(screen.queryByText('Unable to load time entries')).not.toBeInTheDocument();
  });
});

describe('Given the timesheet bridge is unavailable (503 / 403 / network error)', () => {
  it('When the Time Entries tab is opened / Then a distinct error state is shown, NOT the empty state', async () => {
    mockTimesheetApi.getEntries.mockRejectedValue(new Error('503 Service Unavailable'));
    await openTimeTab();

    expect(await screen.findByText('Unable to load time entries')).toBeInTheDocument();
    // The whole point of the fix: a dead integration must not read as "no time logged".
    expect(screen.queryByText('No time entries')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Time entries logged by this person will appear here')
    ).not.toBeInTheDocument();
  });

  it('When the fetch fails / Then the Hours Logged stat does not claim a confident 0h', async () => {
    mockTimesheetApi.getEntries.mockRejectedValue(new Error('403 Forbidden'));
    await openTimeTab();

    await screen.findByText('Unable to load time entries');
    // "0h" would read as "this employee logged nothing", which is exactly the
    // wrong conclusion when the timesheet source never answered.
    expect(screen.queryByText('0h')).not.toBeInTheDocument();
    const hoursLoggedCard = screen.getByText('Hours Logged').closest('div')?.parentElement;
    expect(hoursLoggedCard).toHaveTextContent('—');
  });

  it('When the failure is only a page-level concern / Then the rest of the page still renders', async () => {
    mockTimesheetApi.getEntries.mockRejectedValue(new Error('network error'));
    await openTimeTab();

    await screen.findByText('Unable to load time entries');
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });
});

describe('Given the Time Entries tab is in its error state', () => {
  it('When Retry is clicked / Then a loading indicator is shown while the re-fetch is in flight', async () => {
    mockTimesheetApi.getEntries.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    await openTimeTab();
    await screen.findByText('Unable to load time entries');

    // Second call hangs so the in-flight loading state is observable.
    let release: (value: { data: unknown[] }) => void = () => {};
    mockTimesheetApi.getEntries.mockReturnValueOnce(
      new Promise((resolve) => { release = resolve; })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    const skeleton = await screen.findByTestId('time-entries-loading');
    expect(skeleton).toBeInTheDocument();
    expect(screen.queryByText('Unable to load time entries')).not.toBeInTheDocument();
    expect(screen.queryByText('No time entries')).not.toBeInTheDocument();

    release({ data: [timeEntry] });
    await waitFor(() =>
      expect(screen.queryByTestId('time-entries-loading')).not.toBeInTheDocument()
    );
  });

  it('When Retry succeeds / Then the entries replace the error state', async () => {
    mockTimesheetApi.getEntries.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    await openTimeTab();
    await screen.findByText('Unable to load time entries');

    mockTimesheetApi.getEntries.mockResolvedValueOnce({ data: [timeEntry] });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Apollo Project')).toBeInTheDocument();
    expect(screen.queryByText('Unable to load time entries')).not.toBeInTheDocument();
    expect(mockTimesheetApi.getEntries).toHaveBeenCalledTimes(2);
    expect(mockTimesheetApi.getEntries).toHaveBeenLastCalledWith({ person_id: 'p1', limit: 10 });
  });

  it('When Retry succeeds but there is genuinely nothing logged / Then the empty state is shown', async () => {
    mockTimesheetApi.getEntries.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    await openTimeTab();
    await screen.findByText('Unable to load time entries');

    mockTimesheetApi.getEntries.mockResolvedValueOnce({ data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No time entries')).toBeInTheDocument();
    expect(screen.queryByText('Unable to load time entries')).not.toBeInTheDocument();
  });

  it('When Retry fails again / Then the error state and Retry action persist', async () => {
    mockTimesheetApi.getEntries.mockRejectedValue(new Error('503 Service Unavailable'));
    await openTimeTab();
    await screen.findByText('Unable to load time entries');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mockTimesheetApi.getEntries).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Unable to load time entries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
