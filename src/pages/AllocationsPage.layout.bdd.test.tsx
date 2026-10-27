import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../services/peopleService', () => ({
  allocationsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), cancel: vi.fn() },
  peopleApi: { getAll: vi.fn() },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn() },
  Department: {},
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
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

import AllocationsPage from './AllocationsPage';
import { allocationsApi, peopleApi } from '../services/peopleService';
import { departmentsApi } from '../services/departmentsService';

const mockAllocApi = allocationsApi as any;

const makeAlloc = (overrides: Record<string, unknown> = {}) => ({
  id: 'a1',
  person_id: 'p1',
  person: { id: 'p1', full_name: 'Alice Smith' },
  entity_type: 'project',
  entity_id: 'e1',
  entity_name: 'Apollo',
  start_date: '2026-08-01',
  end_date: '2026-08-31',
  allocation_value: 50,
  status: 'active',
  ...overrides,
});

const renderPage = () => render(<MemoryRouter><AllocationsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  (departmentsApi as any).getTree.mockResolvedValue({ data: [] });
  (peopleApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('Given allocations rendered as a DataTable', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({
      data: [
        makeAlloc(),
        makeAlloc({
          id: 'a2', person_id: 'p2',
          person: { id: 'p2', full_name: 'Bartholomew Fitzgerald-Montgomery III' },
          allocation_value: 100, status: 'completed',
        }),
        makeAlloc({ id: 'a3', person_id: 'p3', person: { id: 'p3', full_name: 'Cara Diaz' }, status: 'cancelled', allocation_value: 25 }),
      ],
      total: 3,
    });
  });

  it('When the list renders / Then each allocation is one table row with column headers', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    // header row + 3 data rows
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThanOrEqual(5);
  });

  it('When rows render / Then each row carries a compact progress bar', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThanOrEqual(3);
  });

  it('When a row is cancelled or completed / Then it offers no row actions', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    // only the active row (Alice) exposes Edit / Cancel allocation
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Cancel allocation' })).toHaveLength(1);
  });
});

describe('Given the allocations filters', () => {
  it('When the page renders / Then Status, Entity type and Department live in the filter config', async () => {
    mockAllocApi.getAll.mockResolvedValue({ data: [makeAlloc()], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Entity type')).toBeInTheDocument();
    expect(screen.getByLabelText('Department')).toBeInTheDocument();
  });
});
