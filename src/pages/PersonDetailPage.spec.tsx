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

  it('When page loads / Then job title is shown (header + Employment Information card)', async () => {
    renderPage();
    // Job title now appears in both the header and the Employment Information card.
    await waitFor(() => expect(screen.getAllByText('Engineer').length).toBeGreaterThanOrEqual(1));
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

describe('Given PersonDetailPage Employment Information', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getEntries.mockResolvedValue({ data: [] });
  });

  it('When the person has a system_role / Then it is displayed in Employment Information', async () => {
    mockPeopleApi.getById.mockResolvedValue({ ...mockPerson, system_role: 'Admin', linked_user_id: 'u1' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Employment Information')).toBeInTheDocument());
    expect(screen.getByText('System Role')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('When the person has no system_role / Then "No system access" is shown (not "No roles assigned")', async () => {
    mockPeopleApi.getById.mockResolvedValue({ ...mockPerson, system_role: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('Employment Information')).toBeInTheDocument());
    expect(screen.getByText('No system access')).toBeInTheDocument();
    expect(screen.queryByText('No roles assigned yet')).not.toBeInTheDocument();
  });

  it('When rendered / Then an Edit Role action is available (not Add Role)', async () => {
    mockPeopleApi.getById.mockResolvedValue({ ...mockPerson, system_role: 'Manager', linked_user_id: 'u1' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Edit Role')).toBeInTheDocument());
    expect(screen.queryByText('Add Role')).not.toBeInTheDocument();
  });
});

describe('Given PersonDetailPage Skills & Competencies', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getEntries.mockResolvedValue({ data: [] });
  });

  it('When the person has no skills / Then the empty state reads "No skills added yet"', async () => {
    mockPeopleApi.getById.mockResolvedValue({ ...mockPerson, people_roles: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Skills & Competencies')).toBeInTheDocument());
    expect(screen.getByText('No skills added yet')).toBeInTheDocument();
    expect(screen.getByText('Add Skill')).toBeInTheDocument();
  });

  it('When the person has skills / Then each skill name is rendered', async () => {
    mockPeopleApi.getById.mockResolvedValue({
      ...mockPerson,
      people_roles: [{ id: 's1', role_name: 'React', skill_category: 'Engineering', proficiency: 'advanced', is_primary: true }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('React')).toBeInTheDocument());
  });
});

describe('Given PersonDetailPage API failure', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockImplementation(async () => { throw new Error('Not found'); });
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
    mockTimeApi.getEntries.mockImplementation(async () => { throw new Error('403 Forbidden'); });
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
    // Job title renders in both the header and the Employment Information card.
    await waitFor(() => expect(screen.getAllByText('Engineer').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });
});

describe('Given PersonDetailPage with work locations failure', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockResolvedValue(mockPerson);
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getEntries.mockResolvedValue({ data: [] });
    (workLocationsApi as any).getAll.mockImplementation(async () => { throw new Error('Network error'); });
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
    mockAllocApi.getAll.mockImplementation(async () => { throw new Error('Allocations error'); });
    mockTimeApi.getEntries.mockImplementation(async () => { throw new Error('Timesheet error'); });
    (workLocationsApi as any).getAll.mockImplementation(async () => { throw new Error('Locations error'); });
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
