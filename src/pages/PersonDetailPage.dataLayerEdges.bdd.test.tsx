import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * Data Layer Class B on Person Detail (people.person) — edge paths (refetch, native save strip, tab styling).
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

// Latest renderer props, so a scenario can invoke a renderer callback after the slot unmounted.
const probe = vi.hoisted(() => ({ last: null as any }));

function ProbeRenderer(props: any) {
  probe.last = props;
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
      <button type="button" onClick={() => props.onChanged?.()}>changed-{props.registration.id}</button>
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

describe('Feature: People Connect Person Detail — data-layer edge paths', () => {
  beforeEach(() => { dl.flag = true; });

  describe('Scenario: native Edit/Save never echoes Class B custom_fields', () => {
    it('then the PATCH body carries the native fields but no custom_fields key', async () => {
      // Given a loaded person whose row carries custom_fields
      mockPeopleApi.update.mockResolvedValueOnce({ ...person });
      await renderLoaded();
      // When the user opens the native edit form and saves it unchanged
      fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      // Then update is called once with native fields only
      await waitFor(() => expect(mockPeopleApi.update).toHaveBeenCalledTimes(1));
      const [calledId, body] = mockPeopleApi.update.mock.calls[0];
      expect(calledId).toBe('p1');
      expect(body).not.toHaveProperty('custom_fields');
      expect(body.full_name).toBe('Alice Smith');
      expect(body.email).toBe('alice@test.com');
    });
  });

  describe('Scenario: a save that does not advance custom_fields_version', () => {
    it('then the page refetches the person row and adopts the fresh version and values', async () => {
      // Given a row at custom_fields_version 3 and a save response still at 3
      mockPeopleApi.getById
        .mockResolvedValueOnce({ ...person, custom_fields_version: 3 })
        .mockResolvedValueOnce({ ...person, custom_fields: { region: 'south', grade: 'L9' }, custom_fields_version: 5 });
      mockPeopleApi.update.mockResolvedValueOnce({ ...person, custom_fields: { region: 'south', grade: 'L5' }, custom_fields_version: 3 });
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer saves
      fireEvent.click(screen.getByText('save-sec'));
      // Then the row is fetched a second time and the fresh row wins
      await waitFor(() => expect(mockPeopleApi.getById).toHaveBeenCalledTimes(2));
      expect(mockPeopleApi.getById).toHaveBeenLastCalledWith('p1');
      await waitFor(() => expect(screen.getByTestId('probe-sec').getAttribute('data-version')).toBe('5'));
      expect(screen.getByTestId('probe-sec-value').textContent).toBe('L9');
    });

    it('then a refetch that returns no row (no id) leaves the saved state untouched', async () => {
      // Given a versioned row, a same-version save, and a refetch returning an empty object
      mockPeopleApi.getById
        .mockResolvedValueOnce({ ...person, custom_fields_version: 3 })
        .mockResolvedValueOnce({});
      mockPeopleApi.update.mockResolvedValueOnce({ ...person, custom_fields: { region: 'south', grade: 'L5' }, custom_fields_version: 3 });
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer saves
      fireEvent.click(screen.getByText('save-sec'));
      // Then the refetch happened but the page still shows the saved value and version
      await waitFor(() => expect(mockPeopleApi.getById).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByTestId('probe-sec-value').textContent).toBe('L5'));
      expect(screen.getByTestId('probe-sec').getAttribute('data-version')).toBe('3');
      expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
    });

    it('then a refetch failure is logged and fails open (page keeps rendering)', async () => {
      // Given a versioned row and a refetch that rejects
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPeopleApi.getById
        .mockResolvedValueOnce({ ...person, custom_fields_version: 3 })
        .mockRejectedValueOnce(new Error('network down'));
      mockPeopleApi.update.mockResolvedValueOnce({ ...person, custom_fields: { region: 'south', grade: 'L5' } });
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer saves and the response carries no version at all
      fireEvent.click(screen.getByText('save-sec'));
      // Then the refresh error is logged, and the saved value is still shown
      await waitFor(() => expect(errSpy).toHaveBeenCalledWith('Failed to refresh person:', expect.any(Error)));
      expect(screen.getByTestId('probe-sec-value').textContent).toBe('L5');
      expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
      errSpy.mockRestore();
    });
  });

  describe('Scenario: a renderer signals an out-of-band change (onChanged)', () => {
    it('then the person row is refetched without resetting the page', async () => {
      // Given a loaded person and a renderer, and a fresh row on the server
      mockPeopleApi.getById
        .mockResolvedValueOnce(person)
        .mockResolvedValueOnce({ ...person, custom_fields: { grade: 'L7' }, updated_at: '2026-10-01T00:00:00Z' });
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer calls onChanged
      fireEvent.click(screen.getByText('changed-sec'));
      // Then the fresh row is merged and its updated_at becomes the slot version
      await waitFor(() => expect(screen.getByTestId('probe-sec-value').textContent).toBe('L7'));
      expect(screen.getByTestId('probe-sec').getAttribute('data-version')).toBe('2026-10-01T00:00:00Z');
      expect(mockPeopleApi.getById).toHaveBeenCalledTimes(2);
      expect(mockPeopleApi.update).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: the PATCH response does not carry custom_fields', () => {
    it('then the page shows the locally merged values (no refetch for an unversioned row)', async () => {
      // Given an unversioned row and a response without custom_fields
      mockPeopleApi.update.mockResolvedValueOnce({ id: 'p1', updated_at: '2026-10-01T09:00:00Z' });
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer saves
      fireEvent.click(screen.getByText('save-sec'));
      // Then the merged value is reflected and the row is not refetched
      await waitFor(() => expect(screen.getByTestId('probe-sec-value').textContent).toBe('L5'));
      expect(mockPeopleApi.getById).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario: injected tab styling follows the active tab', () => {
    it('then the tab is inactive-styled until clicked and active-styled afterwards', async () => {
      // Given an injected detail.tab renderer
      dl.regs = [reg({ id: 'hist', slot: 'detail.tab', renderer: 'field_history', label: 'Field History' })];
      const { container } = await renderLoaded();
      const btn = container.querySelector('[data-dl-tab="dl:hist"]') as HTMLElement;
      // Then before selection it carries the inactive classes
      expect(btn.className).toContain('text-slate-400');
      expect(btn.className).not.toContain('bg-teal-500/10');
      // When it is clicked
      fireEvent.click(btn);
      // Then it carries the active classes
      await waitFor(() => expect(btn.className).toContain('bg-teal-500/10'));
      expect(btn.className).toContain('text-teal-400');
      expect(btn.className).not.toContain('hover:bg-slate-800');
    });
  });
});

describe('Feature: People Connect Person Detail — renderer callbacks after the route changes', () => {
  // Test-only handle on the router so a scenario can change the :id param in place.
  const nav = { go: null as null | ((to: string) => void) };
  function NavHandle() {
    nav.go = useNavigate();
    return null;
  }
  async function renderWithOptionalId() {
    render(
      <MemoryRouter initialEntries={['/people/p1']}>
        <NavHandle />
        <Routes>
          <Route path="/people/:id?" element={<PersonDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0));
  }

  beforeEach(() => {
    dl.flag = true;
    probe.last = null;
  });

  describe('Scenario: the :id param disappears while the person is shown', () => {
    it('then a renderer onChanged does not refetch and the row stays rendered', async () => {
      // Given a loaded person with a detail.section renderer
      dl.regs = [reg({ id: 'sec' })];
      await renderWithOptionalId();
      // When the route loses its id
      act(() => nav.go!('/people'));
      // And the renderer signals an out-of-band change
      fireEvent.click(screen.getByText('changed-sec'));
      await new Promise((r) => setTimeout(r, 20));
      // Then no refetch is attempted and the person is still on screen
      expect(mockPeopleApi.getById).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('probe-sec')).toBeInTheDocument();
    });
  });

  describe('Scenario: the person row is cleared before a pending renderer callback lands', () => {
    it('then a late save keeps the row cleared and a late refetch installs the fresh row', async () => {
      // Given a loaded person whose renderer callbacks were captured
      dl.regs = [reg({ id: 'sec' })];
      await renderWithOptionalId();
      const stale = probe.last;
      // And navigating to another person whose load fails clears the row
      mockPeopleApi.getById.mockRejectedValueOnce(new Error('boom'));
      act(() => nav.go!('/people/p2'));
      await waitFor(() => expect(screen.getByText('Unable to load employee details.')).toBeInTheDocument());
      // When the stale renderer's save resolves
      mockPeopleApi.update.mockResolvedValueOnce({ ...person, custom_fields: { region: 'south', grade: 'L5' } });
      await act(async () => { await stale.onSave({ grade: 'L5' }); });
      // Then the save went to the original row and the page stays in its error state
      expect(mockPeopleApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({ custom_fields: { grade: 'L5' } }));
      expect(screen.getByText('Unable to load employee details.')).toBeInTheDocument();
      // When the stale renderer signals a change and the refetch returns a row
      mockPeopleApi.getById.mockResolvedValueOnce({ ...person, full_name: 'Alice Refetched' });
      await act(async () => { await stale.onChanged(); });
      // Then the refetched row is installed as-is
      expect(mockPeopleApi.getById).toHaveBeenLastCalledWith('p1');
      await waitFor(() => expect(screen.getAllByText('Alice Refetched').length).toBeGreaterThan(0));
    });
  });
});
