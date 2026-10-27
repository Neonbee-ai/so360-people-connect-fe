import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const toastError = vi.fn();
vi.mock('@so360/design-system', async (orig) => {
  const actual = await orig<any>();
  return { ...actual, toast: { ...actual.toast, error: (...a: any[]) => toastError(...a) } };
});

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

// The real UserSelector fetches /v1/tenancy/members; stub it down to a plain
// select so these tests stay about the link workflow, not the picker's internals.
vi.mock('../components/UserSelector', () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <select aria-label={placeholder} value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">none</option>
      <option value="u-42">Bob Jones</option>
    </select>
  ),
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

import PersonDetailPage from './PersonDetailPage';
import { peopleApi, allocationsApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import { goalsApi } from '../services/goalsService';
import { workLocationsApi } from '../services/workLocationsService';

const mockPeopleApi = peopleApi as any;

const unlinkedPerson = {
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

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/people/p1']}>
      <Routes>
        <Route path="/people/:id" element={<PersonDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

const openLinkModal = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Link User')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Link User'));
  await waitFor(() => expect(screen.getByText('Link User Account')).toBeInTheDocument());
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getById.mockResolvedValue(unlinkedPerson);
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  (allocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (timesheetApi as any).getEntries.mockResolvedValue({ data: [] });
  (goalsApi as any).getAll.mockResolvedValue({ data: [] });
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('Given the Comb PersonDetailPage', () => {
  it('When the person loads / Then the title, status badges and tabs render in the template', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Back to People' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Allocations/ })).toBeInTheDocument();
    expect(screen.getByText('Employment Information')).toBeInTheDocument();
    expect(screen.getByText('Skills & Competencies')).toBeInTheDocument();
  });

  it('When the person is still loading / Then the template loading state shows', () => {
    mockPeopleApi.getById.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it('When the person does not exist / Then a Person not found empty state offers Back to list', async () => {
    mockPeopleApi.getById.mockResolvedValue(null);
    renderPage();
    await waitFor(() => expect(screen.getByText('Person not found.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Back to list' })).toBeInTheDocument();
  });

  it('When Edit then Save is clicked / Then the same update payload is sent to the API', async () => {
    mockPeopleApi.update.mockResolvedValue({ ...unlinkedPerson });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Edit$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(mockPeopleApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({ id: 'p1', full_name: 'Alice Smith' })));
  });

  it('When the person is editing / Then Cancel leaves edit mode', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Edit$/ }));
    expect(screen.getByLabelText('Hours/Day')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(screen.queryByLabelText('Hours/Day')).not.toBeInTheDocument();
  });

  it('When saving fails / Then an error toast is raised', async () => {
    mockPeopleApi.update.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Edit$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to update'));
  });

  it('When the viewer may see compensation / Then the Rate History tab and Cost Rate KPI render', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('$100/hour')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Rate History/ })).toBeInTheDocument();
  });

  it('When Add New Rate is submitted / Then the rate modal validates a missing cost rate', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Rate History/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Add new rate/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Rate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid cost rate.');
  });
});
