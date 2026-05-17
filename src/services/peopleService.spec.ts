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

import { peopleApi, allocationsApi, timeEntriesApi, utilizationApi, eventsApi } from './peopleService';
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

describe('Given timeEntriesApi.submit', () => {
  it('When called with id / Then it calls POST /time-entries/:id/submit', async () => {
    mockApi.post.mockResolvedValue({ id: 'te1', status: 'submitted' });
    await timeEntriesApi.submit('te1');
    expect(mockApi.post).toHaveBeenCalledWith('/time-entries/te1/submit', {});
  });
});

describe('Given utilizationApi.getSummary', () => {
  it('When called / Then it calls GET /utilization/summary', async () => {
    mockApi.get.mockResolvedValue({ total_people: 10 });
    await utilizationApi.getSummary();
    expect(mockApi.get).toHaveBeenCalledWith('/utilization/summary');
  });
});

describe('Given eventsApi.getAll', () => {
  it('When called / Then it calls GET /events', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await eventsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/events', undefined);
  });
});
