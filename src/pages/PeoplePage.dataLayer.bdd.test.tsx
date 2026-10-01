/**
 * PeoplePage — Data Layer Class B (people.person) on the list and the Add Person drawer.
 *
 * - list.column: schema fields render as display-only `data-dl-column` cells.
 * - create.section: Shell renderers collect Class B values; required ones block
 *   submit with an inline alert; values ride the native create payload as
 *   `custom_fields` only when the flag is on and something was entered.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// One mutable state object, read lazily by the mock factories (vi.mock hoisting).
const dl = vi.hoisted(() => ({
  flag: false,
  fields: [] as any[],
  regs: [] as any[],
  layouts: {} as Record<string, any>,
}));

function CreateProbe(props: any) {
  return (
    <div data-testid={`create-probe-${props.registration.id}`} data-mode={props.mode} data-values={JSON.stringify(props.values)}>
      <button type="button" onClick={() => props.onValuesChange({ grade: 'L5', region: 'north' })}>fill-classb</button>
    </div>
  );
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock('../services/workLocationsService', () => ({ workLocationsApi: { getAll: vi.fn() } }));
vi.mock('../services/mastersService', () => ({ mastersApi: { getAll: vi.fn() } }));
vi.mock('../services/customFieldsService', () => ({
  customFieldDefsApi: { getAll: vi.fn() },
  personCustomFieldsApi: { getForPerson: vi.fn(), setForPerson: vi.fn() },
  CHOICE_FIELD_TYPES: ['dropdown', 'multi_select'],
}));
vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    cancelInvite: vi.fn(),
    export: vi.fn(),
    getOrgRoles: vi.fn(),
    inviteUser: vi.fn(),
    getLaborCategoryOptions: vi.fn(),
  },
}));
vi.mock('../services/departmentsService', () => ({ departmentsApi: { getTree: vi.fn() } }));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true,
    isAdmin: false,
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
  // Shell dataLayer API — driven by `dl`.
  useDatasetSchema: (code: string | null) => ({ fields: code ? dl.fields : [] }),
  useSlotRenderers: (code: string, slot: string) =>
    dl.regs
      .filter((r: any) => r.dataset_code === code && r.slot === slot)
      .map((r: any) => ({ registration: r, Renderer: CreateProbe, key: r.id })),
  registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
  getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));
vi.mock('../hooks/useShellContext', () => ({
  usePeopleContext: () => ({ orgId: 'o1', tenantId: 't1', userId: 'u1' }),
}));
vi.mock('../services/apiClient', () => ({ apiContext: { getBaseUrl: vi.fn(() => '/people-api') } }));
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
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

import PeoplePage from './PeoplePage';
import { peopleApi } from '../services/peopleService';
import { departmentsApi } from '../services/departmentsService';
import { workLocationsApi } from '../services/workLocationsService';
import { mastersApi } from '../services/mastersService';
import { customFieldDefsApi, personCustomFieldsApi } from '../services/customFieldsService';

const mockPeopleApi = peopleApi as any;

const base = {
  job_title: 'Engineer', type: 'employee', status: 'active', cost_rate: 100, cost_rate_unit: 'hour', currency: 'USD',
  available_hours_per_day: 8, available_days_per_week: 5, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};
const alice = { ...base, id: 'p1', full_name: 'Alice Smith', email: 'alice@test.com', custom_fields: { region: 'south', remote: true } };
const bob = { ...base, id: 'p2', full_name: 'Bob Jones', email: 'bob@test.com' };

const createReg = { id: 'cs', dataset_code: 'people.person', slot: 'create.section', renderer: 'custom_fields' };

beforeEach(() => {
  vi.resetAllMocks();
  dl.flag = false;
  dl.fields = [];
  dl.regs = [];
  dl.layouts = {};
  mockPeopleApi.getAll.mockResolvedValue({ data: [alice, bob], total: 2 });
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  mockPeopleApi.getLaborCategoryOptions.mockResolvedValue([]);
  mockPeopleApi.create.mockResolvedValue({ id: 'new-1' });
  (customFieldDefsApi as any).getAll.mockResolvedValue({ data: [] });
  (personCustomFieldsApi as any).getForPerson.mockResolvedValue({ data: [] });
  (personCustomFieldsApi as any).setForPerson.mockResolvedValue({ data: [] });
  (departmentsApi as any).getTree.mockResolvedValue([]);
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (mastersApi as any).getAll.mockResolvedValue({ data: [] });
});

const renderList = async () => {
  const utils = render(<MemoryRouter><PeoplePage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  return utils;
};

const openCreate = async () => {
  fireEvent.click(screen.getByText('Add Person'));
  await waitFor(() => expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument());
};

const fillNativeAndSubmit = async () => {
  const nameInput = screen.getByPlaceholderText('John Doe');
  fireEvent.change(nameInput, { target: { value: 'New Hire' } });
  await waitFor(() => expect(nameInput).toHaveValue('New Hire'));
  // Employee Only: the default invite mode needs an email + role, irrelevant here.
  fireEvent.click(screen.getByText('Employee Only (No System Access)'));
  fireEvent.submit(nameInput.closest('form')!);
};

describe('Feature: Class B list columns on the People list', () => {
  describe('Scenario: Given the data-layer flag is OFF', () => {
    it('then no data-layer columns render even when schema fields exist', async () => {
      // Given schema fields but the flag off
      dl.fields = [{ field_key: 'region', label: 'Region', field_type: 'text' }];
      // When the list loads
      const { container } = await renderList();
      // Then no data-dl-column cells exist
      expect(container.querySelector('[data-dl-column]')).toBeNull();
    });
  });

  describe('Scenario: Given the flag is ON with schema fields', () => {
    it('then each row shows label: value cells ordered by sort_order, with — for missing values', async () => {
      // Given two visible fields (grade sorted after region) and a boolean field
      dl.flag = true;
      dl.fields = [
        { field_key: 'grade', label: 'Grade', field_type: 'text', sort_order: 2 },
        { field_key: 'region', label: 'Region', field_type: 'text', sort_order: 1 },
        { field_key: 'remote', label: 'Remote', field_type: 'boolean', sort_order: 3 },
      ];
      // When the list loads
      const { container } = await renderList();
      // Then cells follow sort_order per row; Alice shows her values and — for an unset key
      const cells = Array.from(container.querySelectorAll('[data-dl-column]')) as HTMLElement[];
      expect(cells.map((c) => c.getAttribute('data-dl-column'))).toEqual(['region', 'grade', 'remote', 'region', 'grade', 'remote']);
      expect(cells[0].textContent).toBe('Region: south');
      expect(cells[1].textContent).toBe('Grade: —');
      expect(cells[2].textContent).toBe('Remote: Yes');
      // And Bob (no custom_fields at all) shows — in every cell
      expect(cells[3].textContent).toBe('Region: —');
      expect(cells[4].textContent).toBe('Grade: —');
      expect(cells[5].textContent).toBe('Remote: —');
    });

    it('then a flag-on schema with no fields renders no column strip', async () => {
      // Given the flag on but an empty schema
      dl.flag = true;
      // When the list loads
      const { container } = await renderList();
      // Then no data-dl-column cells exist
      expect(container.querySelector('[data-dl-column]')).toBeNull();
    });
  });
});

describe('Feature: Class B values in the Add Person drawer', () => {
  describe('Scenario: Given the flag is OFF', () => {
    it('then no create.section renders and the create payload carries no custom_fields', async () => {
      // Given a registered create.section renderer and a required field, flag off
      dl.regs = [createReg];
      dl.fields = [{ field_key: 'grade', label: 'Grade', field_type: 'text', required: true }];
      await renderList();
      // When the user creates a person
      await openCreate();
      expect(screen.queryByTestId('create-probe-cs')).toBeNull();
      await fillNativeAndSubmit();
      // Then create is called without custom_fields and no required alert shows
      await waitFor(() => expect(mockPeopleApi.create).toHaveBeenCalledTimes(1));
      expect(mockPeopleApi.create.mock.calls[0][0]).not.toHaveProperty('custom_fields');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('Scenario: Given the flag is ON with required Class B fields', () => {
    beforeEach(() => {
      dl.flag = true;
      dl.regs = [createReg];
      // `grade` has no label → the alert falls back to its key
      dl.fields = [
        { field_key: 'region', label: 'Region', field_type: 'text', required: true },
        { field_key: 'grade', field_type: 'text', required: true },
      ];
    });

    it('then submitting with them empty blocks create and names every missing field', async () => {
      // Given the drawer is open with the create.section renderer
      await renderList();
      await openCreate();
      expect(screen.getByTestId('create-probe-cs').getAttribute('data-mode')).toBe('create');
      // When the native form is valid but Class B values are empty
      await fillNativeAndSubmit();
      // Then an inline required alert appears and nothing is created
      const alert = await screen.findByRole('alert');
      expect(alert.getAttribute('data-dl-error')).toBe('required');
      expect(alert.textContent).toBe('Please fill in: Region, grade');
      expect(mockPeopleApi.create).not.toHaveBeenCalled();
    });

    it('then entering values clears the alert and the values ride the create payload as custom_fields', async () => {
      // Given a blocked submit
      await renderList();
      await openCreate();
      await fillNativeAndSubmit();
      await screen.findByRole('alert');
      // When the renderer reports values
      fireEvent.click(screen.getByText('fill-classb'));
      // Then the alert clears
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
      expect(screen.getByTestId('create-probe-cs').getAttribute('data-values')).toBe(JSON.stringify({ grade: 'L5', region: 'north' }));
      // When the form is submitted again
      fireEvent.submit(screen.getByPlaceholderText('John Doe').closest('form')!);
      // Then the native create carries the Class B values
      await waitFor(() => expect(mockPeopleApi.create).toHaveBeenCalledTimes(1));
      expect(mockPeopleApi.create.mock.calls[0][0].custom_fields).toEqual({ grade: 'L5', region: 'north' });
      expect(mockPeopleApi.create.mock.calls[0][0].full_name).toBe('New Hire');
    });

    it('then reopening the drawer clears a previous required alert', async () => {
      // Given a blocked submit showing the alert
      await renderList();
      await openCreate();
      await fillNativeAndSubmit();
      await screen.findByRole('alert');
      // When the drawer is cancelled and reopened
      fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
      await waitFor(() => expect(screen.queryByPlaceholderText('John Doe')).toBeNull());
      await openCreate();
      // Then the alert is gone and the renderer starts with no values
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByTestId('create-probe-cs').getAttribute('data-values')).toBe('{}');
    });
  });

  describe('Scenario: Given the flag is ON with only optional fields left empty', () => {
    it('then create proceeds and the payload carries no custom_fields', async () => {
      // Given an optional field and the renderer untouched
      dl.flag = true;
      dl.regs = [createReg];
      dl.fields = [{ field_key: 'region', label: 'Region', field_type: 'text' }];
      await renderList();
      await openCreate();
      // When the person is created
      await fillNativeAndSubmit();
      // Then create is called without custom_fields
      await waitFor(() => expect(mockPeopleApi.create).toHaveBeenCalledTimes(1));
      expect(mockPeopleApi.create.mock.calls[0][0]).not.toHaveProperty('custom_fields');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
