/**
 * ApiClient — extra scenarios:
 * header propagation, context setters, null/undefined param filtering,
 * PATCH with body, Authorization header absent when no token.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient, apiContext } from '../services/apiClient';

const origFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
  vi.resetAllMocks();
});

afterEach(() => {
  vi.stubGlobal('fetch', origFetch);
});

const makeOkResponse = (body: object) =>
  mockFetch.mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(body)),
  });

describe('ApiClient — extra scenarios', () => {
  const client = new ApiClient('http://api.test');

  describe('Given query param filtering', () => {
    it('When null values are passed / Then they are excluded from query string', async () => {
      makeOkResponse({ ok: true });
      await client.get('/items', { active: true, deleted: null, empty: undefined });
      const url: string = mockFetch.mock.calls[0][0];
      expect(url).toContain('active=true');
      expect(url).not.toContain('deleted');
      expect(url).not.toContain('empty');
    });

    it('When all params are null or undefined / Then no query string is appended', async () => {
      makeOkResponse({ ok: true });
      await client.get('/items', { a: null, b: undefined });
      const url: string = mockFetch.mock.calls[0][0];
      expect(url.replace(/\?$/, '')).toBe('http://api.test/items');
    });

    it('When numeric 0 is passed / Then it IS included in query string', async () => {
      makeOkResponse([]);
      await client.get('/items', { page: 0 });
      const url: string = mockFetch.mock.calls[0][0];
      expect(url).toContain('page=0');
    });
  });

  describe('Given POST request body', () => {
    it('When post is called with data / Then body is JSON-serialized', async () => {
      makeOkResponse({ id: 'new' });
      const data = { name: 'Alice', type: 'employee' };
      await client.post('/people', data);
      const opts = mockFetch.mock.calls[0][1];
      expect(JSON.parse(opts.body as string)).toEqual(data);
      expect(opts.method).toBe('POST');
    });
  });

  describe('Given PATCH request', () => {
    it('When patch is called / Then method is PATCH and body is serialized', async () => {
      makeOkResponse({ id: 'p1', name: 'Updated' });
      await client.patch('/people/p1', { name: 'Updated' });
      const opts = mockFetch.mock.calls[0][1];
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body as string)).toEqual({ name: 'Updated' });
    });
  });

  describe('Given getHeadersRaw', () => {
    it('When called / Then returns an object with X-Tenant-Id key', () => {
      apiContext.setTenantId('t-99');
      const headers = client.getHeadersRaw();
      expect(headers).toHaveProperty('X-Tenant-Id');
    });
  });

  describe('Given apiContext setters', () => {
    it('When setTenantId is called / Then getTenantId reflects the new value', () => {
      apiContext.setTenantId('tenant-abc');
      expect(apiContext.getTenantId()).toBe('tenant-abc');
    });

    it('When setOrgId is called / Then getOrgId reflects the new value', () => {
      apiContext.setOrgId('org-xyz');
      expect(apiContext.getOrgId()).toBe('org-xyz');
    });

    it('When setUserId is called / Then getUserId reflects the new value', () => {
      apiContext.setUserId('user-001');
      expect(apiContext.getUserId()).toBe('user-001');
    });

    it('When setAccessToken is called / Then getAccessToken reflects the new value', () => {
      apiContext.setAccessToken('tok-abc123');
      expect(apiContext.getAccessToken()).toBe('tok-abc123');
    });
  });

  describe('Given multiple sequential requests', () => {
    it('When two GET calls are made / Then fetch is called twice', async () => {
      makeOkResponse([]);
      makeOkResponse([]);
      await client.get('/a');
      await client.get('/b');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Given response with 404 and JSON body', () => {
    it('When server returns 404 with message / Then throws with that message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ message: 'Resource not found' })),
      });
      await expect(client.get('/missing')).rejects.toThrow('Resource not found');
    });
  });

  describe('Given response with 422 and error field', () => {
    it('When server returns error field / Then throws with error field content', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        text: () => Promise.resolve(JSON.stringify({ error: 'Validation error' })),
      });
      await expect(client.post('/people', {})).rejects.toThrow('Validation error');
    });
  });
});
