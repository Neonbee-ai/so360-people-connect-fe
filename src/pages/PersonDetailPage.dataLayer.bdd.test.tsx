import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * Data Layer Class B on Person Detail (people.person).
 * Shell renderers are hosted in named regions behind
 * submodule:data_layer:custom_fields. Values are saved by People Connect through
 * the native PATCH /people/:id (peopleApi.update) with only the changed custom_fields
 * plus the row's custom_fields_version.
 */

// One mutable state object, read lazily by the mock factories (vi.mock hoisting).
const dl = vi.hoisted(() => ({
  flag: false,
  isAdmin: false,
  regs: [] as any[],
  layouts: {} as Record<string, any>,
}));

function ProbeRenderer(props: any) {
  return (
    <div
      data-testid={`probe-${props.registration.id}`}
      data-entity={props.datasetCode}
      data-record-id={props.recordId}
      data-version={String(props.version)}
      data-can-edit={String(props.canEdit)}
      data-save-mode={props.saveMode}
    >
      <span data-testid={`probe-${props.registration.id}-value`}>{String(props.record?.custom_fields?.grade ?? '')}</span>
      <button type="button" onClick={() => props.onSave({ grade: 'L5' })}>save-{props.registration.id}</button>
    </div>
  );
}

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
vi.mock('../services/workLocationsService', () => ({ workLocationsApi: { getAll: vi.fn() }, WorkLocation: {} }));
vi.mock('../components/UserSelector', () => ({ default: () => null }));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true,
    isAdmin: dl.isAdmin,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
    isFeatureHidden: () => false,
    currentTenant: { id: 'tenant-1' },
    currentOrg: { id: 'org-1' },
    user: { id: 'u1', email: 'a@b.com' },
    accessToken: 'tok',
  }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  // Shell dataLayer API — registry is driven by `dl`.
  useDatasetSchema: () => ({ fields: [] }),
  useSlotRenderers: (code: string, slot: string) =>
    dl.regs
      .filter((r: any) => r.dataset_code === code && r.slot === slot)
      .map((r: any) => ({ registration: r, Renderer: ProbeRenderer, key: r.id })),
  registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
  getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    toBusinessDate: (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)),
    businessToday: () => '2026-09-30',
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
  custom_fields: { region: 'south' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2026-09-30T08:00:00Z',
};
const reg = (over: any) => ({ id: 'r1', dataset_code: 'people.person', slot: 'detail.section', renderer: 'custom_fields', ...over });

beforeEach(() => {
  vi.resetAllMocks();
  dl.flag = false;
  dl.isAdmin = false;
  dl.regs = [];
  dl.layouts = {};
  mockPeopleApi.getById.mockResolvedValue(person);
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockPeopleApi.getEmploymentHistory.mockResolvedValue([]);
  mockPeopleApi.getRateHistory.mockResolvedValue([]);
  (allocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (timesheetApi as any).getEntries.mockResolvedValue({ data: [] });
  (goalsApi as any).getAll.mockResolvedValue({ data: [] });
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
});

async function renderLoaded() {
  const utils = render(
    <MemoryRouter initialEntries={['/people/p1']}>
      <Routes>
        <Route path="/people/:id" element={<PersonDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0));
  return utils;
}

describe('Given the data-layer flag is OFF', () => {
  it('When renderers are registered / Then the person page renders no slot regions, wrapper or injected tabs', async () => {
    dl.regs = [reg({}), reg({ id: 'r2', slot: 'detail.sidebar' }), reg({ id: 'r3', slot: 'detail.tab', label: 'History' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
    expect(container.querySelector('[data-dl-tab]')).toBeNull();
    expect(dl.layouts['people.person']).toBeUndefined();
    expect(screen.getByText(/This is the overview of/)).toBeInTheDocument();
  });
});

describe('Given the data-layer flag is ON', () => {
  beforeEach(() => { dl.flag = true; });

  it('When the page loads / Then the people.person record layout is registered with a History tab', async () => {
    await renderLoaded();
    await waitFor(() => expect(dl.layouts['people.person']).toBeTruthy());
    expect(dl.layouts['people.person'].tabOrder).toContain('history');
  });

  it('When nothing is registered / Then the page renders without any data-layer DOM', async () => {
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
  });

  it('When section, sidebar and actions renderers exist / Then each region carries people.person + record context', async () => {
    dl.regs = [reg({ id: 'sec' }), reg({ id: 'side', slot: 'detail.sidebar' }), reg({ id: 'act', slot: 'detail.actions' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-record-layout="people.person"]')?.getAttribute('data-record-id')).toBe('p1');
    for (const [slot, region, id] of [['detail.section', 'main', 'sec'], ['detail.sidebar', 'sidebar', 'side'], ['detail.actions', 'actions', 'act']]) {
      const el = container.querySelector(`[data-dl-slot="${slot}"]`)!;
      expect(el.getAttribute('data-region')).toBe(region);
      expect(el.getAttribute('data-dl-entity')).toBe('people.person');
      expect(el.getAttribute('data-dl-record-id')).toBe('p1');
      const probe = screen.getByTestId(`probe-${id}`);
      expect(probe.getAttribute('data-entity')).toBe('people.person');
      expect(probe.getAttribute('data-record-id')).toBe('p1');
      expect(probe.getAttribute('data-version')).toBe('2026-09-30T08:00:00Z');
      expect(probe.getAttribute('data-save-mode')).toBe('native');
      expect(probe.getAttribute('data-can-edit')).toBe('true');
    }
  });

  it('When a registration targets another entity / Then it is ignored on the person page', async () => {
    dl.regs = [reg({ id: 'item-only', dataset_code: 'inventory.item' })];
    const { container } = await renderLoaded();
    expect(screen.queryByTestId('probe-item-only')).toBeNull();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
  });

  it('When a detail.tab renderer exists / Then an injected tab appears and renders it on click (one tap, no modal)', async () => {
    dl.regs = [reg({ id: 'hist', slot: 'detail.tab', renderer: 'field_history', label: 'Field History' })];
    const { container } = await renderLoaded();
    const btn = container.querySelector('[data-dl-tab="dl:hist"]') as HTMLElement;
    expect(btn.textContent).toBe('Field History');
    expect(screen.queryByTestId('probe-hist')).toBeNull();
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('probe-hist').getAttribute('data-record-id')).toBe('p1'));
    expect(screen.queryByText(/This is the overview of/)).toBeNull();
  });

  it('When registrations are hidden or admin-only and the user is not admin / Then neither is rendered', async () => {
    dl.regs = [reg({ id: 'shown' }), reg({ id: 'secret', visibility_profile: 'hidden' }), reg({ id: 'adm', visibility_profile: 'admin' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-shown')).toBeTruthy();
    expect(screen.queryByTestId('probe-secret')).toBeNull();
    expect(screen.queryByTestId('probe-adm')).toBeNull();
  });

  it('When the user is admin / Then admin-only renderers show but hidden ones still do not', async () => {
    dl.isAdmin = true;
    dl.regs = [reg({ id: 'secret', visibility_profile: 'hidden' }), reg({ id: 'adm', visibility_profile: 'admin' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-adm')).toBeTruthy();
    expect(screen.queryByTestId('probe-secret')).toBeNull();
  });

  it('When a renderer saves / Then the module PATCHes /people/:id with only the changed custom_fields and the page reflects it', async () => {
    mockPeopleApi.update.mockResolvedValueOnce({ ...person, custom_fields: { region: 'south', grade: 'L5' } });
    dl.regs = [reg({ id: 'sec' })];
    await renderLoaded();
    fireEvent.click(screen.getByText('save-sec'));
    await waitFor(() => expect(mockPeopleApi.update).toHaveBeenCalledWith('p1', { custom_fields: { grade: 'L5' } }));
    await waitFor(() => expect(screen.getByTestId('probe-sec-value').textContent).toBe('L5'));
  });

  it('When the row carries custom_fields_version / Then it is the slot version, sent on save, and advanced from the response', async () => {
    mockPeopleApi.getById.mockResolvedValue({ ...person, custom_fields_version: 3 });
    mockPeopleApi.update.mockResolvedValueOnce({ ...person, custom_fields: { region: 'south', grade: 'L5' }, custom_fields_version: 4 });
    dl.regs = [reg({ id: 'sec' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-sec').getAttribute('data-version')).toBe('3');
    fireEvent.click(screen.getByText('save-sec'));
    await waitFor(() => expect(mockPeopleApi.update).toHaveBeenCalledWith('p1', { custom_fields: { grade: 'L5' }, version: 3 }));
    await waitFor(() => expect(screen.getByTestId('probe-sec').getAttribute('data-version')).toBe('4'));
  });
});
