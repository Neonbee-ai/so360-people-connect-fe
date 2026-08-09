import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getHeadersRaw: vi.fn(() => ({ 'X-Tenant-Id': 't1' })),
  },
  apiContext: {
    setTenantId: vi.fn(),
    setOrgId: vi.fn(),
    setUserId: vi.fn(),
    setUserName: vi.fn(),
    setAccessToken: vi.fn(),
    setUser: vi.fn(),
    getBaseUrl: vi.fn(() => '/people-api'),
    getTenantId: vi.fn(),
    getOrgId: vi.fn(),
    getUserId: vi.fn(),
    getAccessToken: vi.fn(),
  },
}));

import { peopleApi, allocationsApi, utilizationApi, eventsApi } from './peopleService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given peopleApi.getAll', () => {
  it('When called without params / Then it calls GET /people', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await peopleApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/people', undefined);
  });

  it('When called with search and status / Then params are passed through', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await peopleApi.getAll({ search: 'alice', status: 'active' });
    expect(mockApi.get).toHaveBeenCalledWith('/people', { search: 'alice', status: 'active' });
  });
});

describe('Given peopleApi.getById', () => {
  it('When called with id / Then it calls GET /people/:id', async () => {
    mockApi.get.mockResolvedValue({ id: 'p1', full_name: 'Alice' });
    await peopleApi.getById('p1');
    expect(mockApi.get).toHaveBeenCalledWith('/people/p1');
  });
});

describe('Given peopleApi.create', () => {
  it('When called with payload / Then it calls POST /people', async () => {
    const payload = { full_name: 'Bob', type: 'employee' as const, cost_rate: 100, cost_rate_unit: 'hour' as const, currency: 'USD' };
    mockApi.post.mockResolvedValue({ id: 'p-new', ...payload });
    await peopleApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/people', payload);
  });
});

describe('Given peopleApi.update', () => {
  it('When called with id and data / Then it calls PATCH /people/:id', async () => {
    mockApi.patch.mockResolvedValue({ id: 'p1', status: 'inactive' });
    await peopleApi.update('p1', { status: 'inactive' });
    expect(mockApi.patch).toHaveBeenCalledWith('/people/p1', { status: 'inactive' });
  });
});

describe('Given peopleApi.updateSystemRole', () => {
  it('When called with personId and roleId / Then it PATCHes /people/:id/system-role with role_id', async () => {
    mockApi.patch.mockResolvedValue({ role_id: 'role-9' });
    await peopleApi.updateSystemRole('p1', 'role-9');
    expect(mockApi.patch).toHaveBeenCalledWith('/people/p1/system-role', { role_id: 'role-9' });
  });
});

describe('Given peopleApi.delete', () => {
  it('When called with id / Then it calls DELETE /people/:id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Deleted' });
    await peopleApi.delete('p1');
    expect(mockApi.delete).toHaveBeenCalledWith('/people/p1');
  });
});

describe('Given allocationsApi.getAll', () => {
  it('When called / Then it calls GET /allocations', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await allocationsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/allocations', undefined);
  });
});

describe('Given utilizationApi.getSummary', () => {
  it('When called / Then it calls GET /utilization/summary', async () => {
    mockApi.get.mockResolvedValue({ total_people: 10 });
    await utilizationApi.getSummary();
    expect(mockApi.get).toHaveBeenCalledWith('/utilization/summary');
  });
});

describe('Given utilizationApi.getAll', () => {
  // The backend returns a flat per-person row (person_id, person_name,
  // logged_hours, cost, ...) — see utilization.service.ts. The UI reads a
  // nested { person, utilization } shape, so getAll must reshape every row;
  // a regression here reintroduces the "Cannot read properties of undefined
  // (reading 'full_name')" crash on the Utilization page.
  it('When the backend returns a flat row / Then it is reshaped into nested person/utilization objects', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        {
          person_id: 'p1',
          person_name: 'Alice',
          person_email: 'alice@test.com',
          job_title: 'Engineer',
          available_hours: 40,
          logged_hours: 32,
          utilization_pct: 80,
          target_utilization: 80,
          allocation_pct: 100,
          cost: 1600,
          is_idle: false,
          is_overallocated: false,
        },
      ],
      period: { start: '2026-08-03', end: '2026-08-07' },
    });

    const result = await utilizationApi.getAll();

    expect(mockApi.get).toHaveBeenCalledWith('/utilization', undefined);
    expect(result.period).toEqual({ start: '2026-08-03', end: '2026-08-07' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].person).toMatchObject({ id: 'p1', full_name: 'Alice', email: 'alice@test.com', job_title: 'Engineer' });
    expect(result.data[0].utilization).toMatchObject({
      available_hours: 40,
      actual_hours: 32,
      actual_cost: 1600,
      utilization_pct: 80,
      allocation_pct: 100,
      is_idle: false,
      is_overallocated: false,
    });
  });

  it('When a row has no allocation/hours data / Then it defaults to zeroed, non-undefined numeric fields', async () => {
    mockApi.get.mockResolvedValue({
      data: [{ person_id: 'p2', person_name: 'Bob', is_idle: true, is_overallocated: false }],
      period: { start: '2026-08-03', end: '2026-08-07' },
    });

    const result = await utilizationApi.getAll();

    expect(result.data[0].utilization.available_hours).toBe(0);
    expect(result.data[0].utilization.actual_hours).toBe(0);
    expect(result.data[0].utilization.actual_cost).toBe(0);
    expect(result.data[0].utilization.allocation_pct).toBe(0);
  });

  it('When called with period params / Then they are forwarded to GET /utilization', async () => {
    mockApi.get.mockResolvedValue({ data: [], period: { start: 'a', end: 'b' } });
    await utilizationApi.getAll({ period_start: '2026-08-03', period_end: '2026-08-07' });
    expect(mockApi.get).toHaveBeenCalledWith('/utilization', { period_start: '2026-08-03', period_end: '2026-08-07' });
  });
});

describe('Given eventsApi.getAll', () => {
  it('When called / Then it calls GET /events', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await eventsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/events', undefined);
  });
});
