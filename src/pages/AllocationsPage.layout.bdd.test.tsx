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

/** Each allocation card is the element carrying the row grid. */
const cards = () => Array.from(document.querySelectorAll('.grid.items-center'));

beforeEach(() => {
  vi.resetAllMocks();
  (departmentsApi as any).getTree.mockResolvedValue({ data: [] });
  (peopleApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('Given allocation rows with different content lengths and statuses', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({
      data: [
        makeAlloc(),
        makeAlloc({
          id: 'a2',
          person_id: 'p2',
          person: { id: 'p2', full_name: 'Bartholomew Fitzgerald-Montgomery III' },
          entity_name: 'A Very Long Programme Of Works That Would Previously Push Columns Around',
          allocation_value: 100,
          status: 'completed',
        }),
        makeAlloc({ id: 'a3', person_id: 'p3', person: { id: 'p3', full_name: 'Cara Diaz' }, status: 'cancelled', allocation_value: 25 }),
      ],
      total: 3,
    });
  });

  it('When the list renders / Then every row uses the same column track definition', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    const rows = cards();
    expect(rows).toHaveLength(3);
    const trackDefinitions = new Set(rows.map(row => row.className));
    // One shared class string means one shared grid — no per-row drift.
    expect(trackDefinitions.size).toBe(1);
  });

  it('When an entity name is very long / Then it truncates instead of widening its column', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/A Very Long Programme Of Works/)).toBeInTheDocument());

    expect(screen.getByText(/A Very Long Programme Of Works/).className).toContain('truncate');
  });

  it('When a row has no actions (cancelled/completed) / Then the actions cell is still rendered so columns stay aligned', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Cara Diaz')).toBeInTheDocument());

    // 5 cells per row: avatar, info, %, status, actions.
    for (const row of cards()) {
      expect(row.children).toHaveLength(5);
    }
  });

  it('When a row is not active / Then the capacity bar track is still present so rows share one height', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Cara Diaz')).toBeInTheDocument());

    const bars = document.querySelectorAll('[role="presentation"]');
    expect(bars).toHaveLength(3);
  });

  it('When a row is active / Then its capacity bar is filled to the allocation percentage', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    const activeTrack = document.querySelectorAll('[role="presentation"]')[0];
    const fill = activeTrack.querySelector('div') as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('50%');
  });

  it('When a row is cancelled / Then its capacity bar track is empty', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Cara Diaz')).toBeInTheDocument());

    const cancelledTrack = document.querySelectorAll('[role="presentation"]')[2];
    expect(cancelledTrack.querySelector('div')).toBeNull();
  });

  it('When actions are available / Then edit and cancel have accessible names', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    expect(screen.getAllByLabelText('Edit allocation').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Cancel allocation').length).toBeGreaterThan(0);
  });
});

describe('Given the allocations filter bar', () => {
  it('When the page renders / Then the summary stats sit in the same row as the filters', async () => {
    mockAllocApi.getAll.mockResolvedValue({ data: [makeAlloc()], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('1 allocation')).toBeInTheDocument());

    const stats = screen.getByText('1 allocation').parentElement!;
    const filterRow = stats.parentElement!;
    expect(filterRow.className).toContain('justify-between');
    expect(filterRow.className).toContain('items-center');
  });
});
