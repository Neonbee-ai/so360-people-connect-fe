import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/peopleService', () => ({
  allocationsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
  peopleApi: { getAll: vi.fn() },
  entitiesApi: { list: vi.fn() },
}));

let mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ ...mockShellFlags, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

// Symbol the org formatter renders. Defaults to '$' (USD); the BDD currency spec
// flips it to prove rates are formatted via the org's business-settings currency
// rather than a hardcoded '$'.
let mockCurrencySymbol = '$';
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `${mockCurrencySymbol}${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

import AllocationsPage from '../pages/AllocationsPage';
import { allocationsApi, peopleApi, entitiesApi } from '../services/peopleService';

const mockAllocApi = allocationsApi as any;
const mockPeopleApi = peopleApi as any;
const mockEntitiesApi = entitiesApi as any;

const renderPage = () =>
  render(<MemoryRouter><AllocationsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
  mockEntitiesApi.list.mockResolvedValue({ data: [] });
});

describe('AllocationsPage', () => {
  describe('Given allocations are loaded', () => {
    beforeEach(() => {
      mockAllocApi.getAll.mockResolvedValue({
        data: [
          { id: 'a1', person_id: 'p1', person: { full_name: 'Alice' }, entity_type: 'project', entity_id: 'proj-1', entity_name: 'Website', start_date: '2026-01-01', end_date: '2026-06-30', allocation_value: 80, allocation_type: 'percentage', status: 'active', notes: '' },
          { id: 'a2', person_id: 'p1', person: { full_name: 'Alice' }, entity_type: 'project', entity_id: 'proj-2', entity_name: 'Mobile App', start_date: '2026-01-01', end_date: '2026-06-30', allocation_value: 40, allocation_type: 'percentage', status: 'active', notes: '' },
        ],
      });
    });

    it('When the page loads / Then allocation cards are rendered', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
      expect(screen.getByText('Mobile App')).toBeInTheDocument();
    });

    it('When a person is overallocated / Then a warning is shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getAllByText(/120% allocated/).length).toBeGreaterThan(0));
    });

    it('When the status filter is changed / Then allocations are re-fetched', async () => {
      renderPage();
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalled());
      fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'active' } });
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' })));
    });

    it('When the summary stats are displayed / Then they count correctly', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('2 allocations')).toBeInTheDocument());
      expect(screen.getByText('2 active')).toBeInTheDocument();
    });
  });

  describe('Given the user interacts with allocations', () => {
    beforeEach(() => {
      mockAllocApi.getAll.mockResolvedValue({
        data: [
          { id: 'a1', person_id: 'p1', person: { full_name: 'Alice' }, entity_type: 'project', entity_id: 'proj-1', entity_name: 'Website', start_date: '2026-01-01', end_date: '2026-06-30', allocation_value: 80, allocation_type: 'percentage', status: 'active', notes: '' },
        ],
      });
    });

    it('When entity type filter is changed / Then allocations are re-fetched', async () => {
      renderPage();
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalled());
      fireEvent.change(screen.getByDisplayValue('All Entity Types'), { target: { value: 'project' } });
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ entity_type: 'project' })));
    });

    it('When New Allocation is clicked / Then the create modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
      fireEvent.click(screen.getByText('New Allocation'));
      await waitFor(() => expect(screen.getByText('Person *')).toBeInTheDocument());
    });
  });

  describe('Given the org-wide currency is not USD', () => {
    beforeEach(() => {
      mockCurrencySymbol = 'AED ';
      mockAllocApi.getAll.mockResolvedValue({ data: [] });
      mockPeopleApi.getAll.mockResolvedValue({
        data: [{ id: 'p1', full_name: 'Alice', job_title: 'Dev', type: 'employee', cost_rate: 50, cost_rate_unit: 'hour' }],
      });
    });
    afterEach(() => { mockCurrencySymbol = '$'; });

    it('When the person picker lists a cost rate / Then it renders in the org currency, not a hardcoded $', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('New Allocation')).toBeInTheDocument());
      fireEvent.click(screen.getByText('New Allocation'));
      await waitFor(() => expect(screen.getByText(/AED 50\/hour/)).toBeInTheDocument());
      expect(screen.queryByText(/\$50\/hour/)).not.toBeInTheDocument();
    });
  });

  describe('Given no allocations exist', () => {
    beforeEach(() => {
      mockAllocApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then the empty state is shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No allocations')).toBeInTheDocument());
    });
  });
});

describe('AllocationsPage — effectiveFlagsLoaded gate', () => {
  it('When effectiveFlagsLoaded is false / Then New Allocation button is absent', async () => {
    mockShellFlags = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No allocations')).toBeInTheDocument());
    expect(screen.queryByText('New Allocation')).not.toBeInTheDocument();
  });

  it('When effectiveFlagsLoaded is true / Then New Allocation button is present', async () => {
    mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No allocations')).toBeInTheDocument());
    expect(screen.getByText('New Allocation')).toBeInTheDocument();
  });
});
