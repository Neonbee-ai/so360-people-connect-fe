import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    export: vi.fn(),
    getOrgRoles: vi.fn().mockResolvedValue({ data: [] }),
  },
  apiContext: {
    getBaseUrl: vi.fn(() => '/people-api'),
  },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

vi.mock('../hooks/useShellContext', () => ({
  usePeopleContext: () => ({ orgId: 'o1', tenantId: 't1', userId: 'u1' }),
}));

vi.mock('../services/apiClient', () => ({
  apiContext: { getBaseUrl: vi.fn(() => '/people-api') },
}));

import PeoplePage from './PeoplePage';
import { departmentsApi } from '../services/departmentsService';
import { peopleApi } from '../services/peopleService';
import { workLocationsApi } from '../services/workLocationsService';

const mockApi = peopleApi as any;
const mockWorkLocationsApi = workLocationsApi as any;

const renderPage = () => render(<MemoryRouter><PeoplePage /></MemoryRouter>);

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
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  (departmentsApi as any).getTree.mockResolvedValue([]);
  mockApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockWorkLocationsApi.getAll.mockResolvedValue({ data: [] });
});

describe('Given PeoplePage loads with people', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When page loads / Then "People" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('People Registry')).toBeInTheDocument());
  });

  it('When people are fetched / Then person name is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When people are fetched / Then status badge is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
  });
});

describe('Given PeoplePage with no people', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no people exist / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No people/i)).toBeInTheDocument());
  });
});

describe('Given PeoplePage search interaction', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When search box is present / Then it can receive input', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    expect(searchInput).toHaveValue('Alice');
  });
});

describe('Given PeoplePage search debounce', () => {
  // Timer approach: PeoplePage has NO setInterval, so vi.useFakeTimers() is
  // safe. We drive input with fireEvent.change (NOT userEvent) and advance the
  // clock manually so the 300ms debounce can be asserted deterministically.
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When several keystrokes arrive in quick succession / Then the list query fires once after the 300ms pause (input stays instant)', async () => {
    renderPage();
    // Initial load (debouncedSearch === '') happens on mount.
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    const callsAfterMount = mockApi.getAll.mock.calls.length;

    const searchInput = screen.getByPlaceholderText(/Search/i);

    vi.useFakeTimers();
    try {
      // Three rapid keystrokes — the input value updates instantly each time.
      fireEvent.change(searchInput, { target: { value: 'A' } });
      fireEvent.change(searchInput, { target: { value: 'Al' } });
      fireEvent.change(searchInput, { target: { value: 'Ali' } });
      expect(searchInput).toHaveValue('Ali');

      // Before the debounce window elapses, no new fetch is issued.
      vi.advanceTimersByTime(299);
      expect(mockApi.getAll.mock.calls.length).toBe(callsAfterMount);

      // Crossing 300ms triggers exactly one debounced fetch with the final term.
      vi.advanceTimersByTime(1);
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() =>
      expect(mockApi.getAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Ali' }),
      ),
    );
    // Only one additional call beyond mount despite three keystrokes.
    expect(mockApi.getAll.mock.calls.length).toBe(callsAfterMount + 1);
  });

  it('When typing pauses before completing / Then no intermediate term is ever queried', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/Search/i);

    vi.useFakeTimers();
    try {
      fireEvent.change(searchInput, { target: { value: 'Bob' } });
      // Advance only partway — timer still pending, restart on next keystroke.
      vi.advanceTimersByTime(200);
      fireEvent.change(searchInput, { target: { value: 'Bobby' } });
      vi.advanceTimersByTime(300);
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() =>
      expect(mockApi.getAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Bobby' }),
      ),
    );
    // The intermediate 'Bob' term must never have been sent to the backend.
    const searchedTerms = mockApi.getAll.mock.calls.map((c: any[]) => c[0]?.search);
    expect(searchedTerms).not.toContain('Bob');
  });
});

describe('Given PeoplePage create modal', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  });

  it('When Add Person is clicked / Then create modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
  });
});
