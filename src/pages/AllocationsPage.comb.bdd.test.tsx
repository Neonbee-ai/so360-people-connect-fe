import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

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

vi.mock('../services/departmentsService', () => ({
  departmentsApi: {
    getTree: vi.fn(),
  },
}));

let mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ ...mockShellFlags, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
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
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

import AllocationsPage from './AllocationsPage';
import { allocationsApi, peopleApi, entitiesApi } from '../services/peopleService';
import { departmentsApi } from '../services/departmentsService';
import { toast } from '@so360/design-system';

const mockAllocApi = allocationsApi as any;
const mockPeopleApi = peopleApi as any;
const mockEntitiesApi = entitiesApi as any;
const mockDeptApi = departmentsApi as any;

const renderPage = () => render(<MemoryRouter><AllocationsPage /></MemoryRouter>);

const alloc = {
  id: 'a1', person_id: 'p1', person: { full_name: 'Alice' }, entity_type: 'project', entity_id: 'proj-1',
  entity_name: 'Website', start_date: '2026-01-01', end_date: '2026-06-30', allocation_value: 80,
  allocation_type: 'percentage', status: 'active', notes: '',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
  mockEntitiesApi.list.mockResolvedValue({ data: [] });
  mockDeptApi.getTree.mockResolvedValue({ data: [] });
});

describe('Given the Allocations list page', () => {
  it('When it loads / Then the Comb list template shows the title and New Allocation action', async () => {
    mockAllocApi.getAll.mockResolvedValue({ data: [alloc] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    expect(screen.getByTestId('list-page-template')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Allocations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Allocation/ })).toBeInTheDocument();
  });

  it('When the request is pending / Then a loading status is shown', () => {
    mockAllocApi.getAll.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('When there are no allocations / Then the empty state is shown', async () => {
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No allocations')).toBeInTheDocument());
  });

  it('When the create flag is off / Then New Allocation is not offered', async () => {
    mockShellFlags = { ...mockShellFlags, isFeatureEnabled: () => false };
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No allocations')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /New Allocation/ })).not.toBeInTheDocument();
  });

  it('When the status filter changes / Then getAll is called with that status', async () => {
    mockAllocApi.getAll.mockResolvedValue({ data: [alloc] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'planned' } });
    await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'planned' })));
  });

  it('When Edit is saved / Then the update API is called with the new percentage', async () => {
    mockAllocApi.getAll.mockResolvedValue({ data: [alloc] });
    mockAllocApi.update.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByDisplayValue('80'), { target: { value: '60' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mockAllocApi.update).toHaveBeenCalledWith('a1', expect.objectContaining({ allocation_percentage: 60 })));
  });

  it('When cancelling fails / Then an error toast is shown', async () => {
    const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
    mockAllocApi.getAll.mockResolvedValue({ data: [alloc] });
    mockAllocApi.cancel.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Cancel allocation'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel allocation' }));
    await waitFor(() => expect(err).toHaveBeenCalledWith('Failed to cancel allocation'));
  });
});
