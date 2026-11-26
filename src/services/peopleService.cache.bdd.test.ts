import { describe, it, expect, vi, beforeEach } from 'vitest';

let ORG = 'org-1';

vi.mock('./apiClient', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getHeadersRaw: vi.fn().mockReturnValue({}),
  };
  return {
    api: mockApi,
    ApiClient: vi.fn(),
    apiContext: {
      getBaseUrl: () => '/people-api',
      getTenantId: () => 't1',
      getOrgId: () => ORG,
      getUserId: () => 'u1',
      getAccessToken: () => 'tok',
      setTenantId: vi.fn(),
      setOrgId: vi.fn(),
      setUserId: vi.fn(),
      setUserName: vi.fn(),
      setAccessToken: vi.fn(),
      setUser: vi.fn(),
    },
  };
});

import { api } from './apiClient';
import { utilizationApi, utilizationCache, peopleApi, peopleReadCache } from './peopleService';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  ORG = 'org-1';
  mockApi.get.mockReset();
  utilizationCache.invalidate();
  peopleReadCache.invalidate();
});

describe('utilizationApi.getSummary cache', () => {
  describe('Given the summary is requested concurrently', () => {
    it('When getSummary is called twice at once / Then only one request is made', async () => {
      const d = deferred<any>();
      mockApi.get.mockReturnValue(d.promise);

      const all = Promise.all([utilizationApi.getSummary(), utilizationApi.getSummary()]);
      d.resolve({ total_people: 10, avg_utilization_pct: 70 });
      const [a, b] = await all;

      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(a.total_people).toBe(10);
      expect(b.total_people).toBe(10);
    });
  });

  describe('Given the summary was already fetched', () => {
    it('When getSummary is called again within the TTL / Then the cached value is served', async () => {
      mockApi.get.mockResolvedValue({ total_people: 5, avg_utilization_pct: 50 });

      await utilizationApi.getSummary();
      const second = await utilizationApi.getSummary();

      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(second.total_people).toBe(5);
    });
  });

  describe('Given the org changes', () => {
    it('When a different org requests the summary / Then a fresh request is made', async () => {
      mockApi.get.mockResolvedValue({ total_people: 1, avg_utilization_pct: 10 });
      await utilizationApi.getSummary();
      expect(mockApi.get).toHaveBeenCalledTimes(1);

      ORG = 'org-2';
      await utilizationApi.getSummary();
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Given a failed request', () => {
    it('When getSummary rejects / Then the failure is not cached', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('boom'));
      await expect(utilizationApi.getSummary()).rejects.toThrow('boom');

      mockApi.get.mockResolvedValue({ total_people: 3, avg_utilization_pct: 30 });
      const retry = await utilizationApi.getSummary();

      expect(mockApi.get).toHaveBeenCalledTimes(2);
      expect(retry.total_people).toBe(3);
    });
  });
});

describe('peopleApi roster and getMe cache', () => {
  it('Given two pickers ask for the active roster / When both run / Then one request is made', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 'p1' }] });
    await Promise.all([
      peopleApi.getAll({ status: 'active', limit: 200 }),
      peopleApi.getAll({ status: 'active', limit: 200 }),
    ]);
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it('Given a directory page request / When called twice / Then it is never cached', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await peopleApi.getAll({ page: 1, limit: 50 });
    await peopleApi.getAll({ page: 1, limit: 50 });
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });

  it('Given the roster was cached in another org / When the org differs / Then it is fetched again', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await peopleApi.getAll({ status: 'active', limit: 200 });
    ORG = 'org-2';
    await peopleApi.getAll({ status: 'active', limit: 200 });
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });

  it('Given getMe is called at several sites / When called twice / Then one request is made', async () => {
    mockApi.get.mockResolvedValue({ id: 'me' });
    await peopleApi.getMe();
    await peopleApi.getMe();
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it('Given the roster is cached / When a person is updated / Then the next read refetches', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    mockApi.patch.mockResolvedValue({ id: 'p1' });
    await peopleApi.getAll({ status: 'active', limit: 200 });
    await peopleApi.update('p1', { full_name: 'X' } as any);
    await peopleApi.getAll({ status: 'active', limit: 200 });
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });
});
