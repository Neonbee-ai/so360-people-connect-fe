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
import { utilizationApi, utilizationCache } from './peopleService';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  ORG = 'org-1';
  mockApi.get.mockReset();
  utilizationCache.invalidate();
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
