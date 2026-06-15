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

describe('Given the Department field in the create modal', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
    (departmentsApi as any).getTree.mockResolvedValue([
      { id: 'dep-eng', name: 'Engineering', code: 'ENG', children: [] },
      { id: 'dep-sales', name: 'Sales', code: 'SALES', children: [] },
    ]);
  });

  const openModal = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Person'));
    await waitFor(() => expect(screen.getByText(/Full Name/i)).toBeInTheDocument());
  };

  it('When the modal opens / Then Department is a searchable dropdown, not a free-text input', async () => {
    await openModal();
    // The old free-text input used placeholder "Engineering" — it must be gone.
    expect(screen.queryByPlaceholderText('Engineering')).not.toBeInTheDocument();
    // The DepartmentSelector dropdown placeholder is present instead.
    expect(screen.getByText('Select department...')).toBeInTheDocument();
  });

  it('When a department is searched and selected / Then the create payload stores department_id (relational ref, no free text)', async () => {
    await openModal();

    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'New Hire' } });

    // Open the dropdown and load active departments.
    fireEvent.click(screen.getByText('Select department...'));
    await waitFor(() => expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0));

    // Search narrows the list.
    const searchBox = screen.getByPlaceholderText('Select department...');
    fireEvent.change(searchBox, { target: { value: 'eng' } });
    await waitFor(() => expect(screen.queryByText('Sales')).not.toBeInTheDocument());

    // Click the dropdown option (last 'Engineering' in DOM is the dropdown span)
    const engItems = screen.getAllByText('Engineering');
    fireEvent.click(engItems[engItems.length - 1]);

    // Submit – find only button elements named 'Add Person' to skip the modal <h2> title
    const submitButtons = screen.getAllByRole('button', { name: /Add Person/i });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
    const payload = mockApi.create.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({ department_id: 'dep-eng' }));
    expect(payload).not.toHaveProperty('department');
  });

  it('When no department is selected / Then department_id is omitted (not an empty string)', async () => {
    await openModal();
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'No Dept' } });

    // Use role query to target only <button> elements, skipping the modal <h2> title
    const submitButtons = screen.getAllByRole('button', { name: /Add Person/i });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
    expect(mockApi.create.mock.calls[0][0].department_id).toBeUndefined();
  });
});
