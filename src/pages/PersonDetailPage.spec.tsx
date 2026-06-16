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
  workLocationsApi: { getAll: vi.fn().mockResolvedValue([]) },
  WorkLocation: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

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
  currency: 'USD',
  available_hours_per_day: 8,
  available_days_per_week: 5,
  people_roles: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockGoalsApi.getAll.mockResolvedValue({ data: [] });
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('Given PersonDetailPage loads successfully', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockResolvedValue(mockPerson);
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getEntries.mockResolvedValue({ data: [] });
  });

  it('When page loads / Then person full name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When page loads / Then job title is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineer')).toBeInTheDocument());
  });

  it('When page loads / Then status badge is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
  });

  it('When page loads / Then email is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
  });
});

describe('Given PersonDetailPage API failure', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockRejectedValue(new Error('Not found'));
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getEntries.mockResolvedValue({ data: [] });
  });

  it('When person load fails / Then the error state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Unable to load employee details.')).toBeInTheDocument());
  });
});

describe('Given PersonDetailPage tab navigation', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockResolvedValue(mockPerson);
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getEntries.mockResolvedValue({ data: [] });
  });

  it('When page loads / Then the overview tab is active by default', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });
});

// Secondary data failures must NOT block the page or show a page-level error
// banner. Timesheet 403 is expected for users without timesheet permissions;
// work-locations failure is non-critical. Each tab shows its own empty state.
describe('Given PersonDetailPage with timesheet 403', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockResolvedValue(mockPerson);
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    // Timesheet returns 403 — expected for users without timesheet permissions
    mockTimeApi.getEntries.mockRejectedValue(new Error('403 Forbidden'));
    (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
  });

  it('When timesheet returns 403 / Then the person profile still renders', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When timesheet returns 403 / Then NO page-level "Some details could not be loaded" toast appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    // The old code showed this toast for any secondary failure — must not appear now
    expect(screen.queryByText(/some details could not be loaded/i)).not.toBeInTheDocument();
  });

  it('When timesheet returns 403 / Then the job title and email are still displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineer')).toBeInTheDocument());
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });
});

describe('Given PersonDetailPage with work locations failure', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockResolvedValue(mockPerson);
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getEntries.mockResolvedValue({ data: [] });
    (workLocationsApi as any).getAll.mockRejectedValue(new Error('Network error'));
  });

  it('When work locations fail / Then the person profile still renders', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When work locations fail / Then NO page-level error toast appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.queryByText(/some details could not be loaded/i)).not.toBeInTheDocument();
  });
});

describe('Given PersonDetailPage with all secondary APIs failing', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockResolvedValue(mockPerson);
    mockAllocApi.getAll.mockRejectedValue(new Error('Allocations error'));
    mockTimeApi.getEntries.mockRejectedValue(new Error('Timesheet error'));
    (workLocationsApi as any).getAll.mockRejectedValue(new Error('Locations error'));
  });

  it('When all secondary data fails / Then person name is still shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When all secondary data fails / Then no page-level toast for secondary failures', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.queryByText(/some details could not be loaded/i)).not.toBeInTheDocument();
  });
});
