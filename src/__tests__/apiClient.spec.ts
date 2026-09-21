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

describe('ApiClient', () => {
  const client = new ApiClient('http://test');

  describe('Given a successful GET request', () => {
    it('When called with params / Then it builds query string and returns parsed JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"id":"1"}'),
      });

      const result = await client.get('/items', { status: 'active', page: 1, empty: '' });
      expect(result).toEqual({ id: '1' });
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('status=active');
      expect(url).toContain('page=1');
      expect(url).not.toContain('empty');
    });

    it('When called without params / Then no query string is appended', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"ok":true}'),
      });

      await client.get('/items');
      expect(mockFetch.mock.calls[0][0]).toBe('http://test/items');
    });
  });

  describe('Given a POST request', () => {
    it('When called / Then it sends JSON body with POST method', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"id":"new"}'),
      });

      const result = await client.post('/items', { name: 'test' });
      expect(result).toEqual({ id: 'new' });
      const opts = mockFetch.mock.calls[0][1];
      expect(opts.method).toBe('POST');
      expect(opts.body).toBe(JSON.stringify({ name: 'test' }));
    });
  });

  describe('Given a PATCH request', () => {
    it('When called / Then it sends PATCH method', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"updated":true}'),
      });

      await client.patch('/items/1', { name: 'updated' });
      expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
    });
  });

  describe('Given a DELETE request', () => {
    it('When called / Then it sends DELETE method', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"deleted":true}'),
      });

      await client.delete('/items/1');
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });
  });

  describe('Given an error response with JSON body', () => {
    it('When the server returns 400 / Then it throws with the error message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"message":"Bad request"}'),
      });

      await expect(client.get('/fail')).rejects.toThrow('Bad request');
    });
  });

  describe('Given an error response with plain text body', () => {
    it('When the server returns 500 / Then it throws with the text', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(client.get('/fail')).rejects.toThrow('Internal Server Error');
    });
  });

  describe('Given an error response with empty body', () => {
    it('When the body is empty / Then it throws with the status code', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(''),
      });

      await expect(client.get('/fail')).rejects.toThrow('API Error: 404');
    });
  });

  describe('Given a successful response with invalid JSON', () => {
    it('When the response is not JSON / Then it throws Invalid JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not json'),
      });

      await expect(client.get('/bad-json')).rejects.toThrow('Invalid JSON response');
    });
  });

  describe('Given a network error', () => {
    it('When fetch throws / Then the error propagates', async () => {
      mockFetch.mockImplementation(async () => { throw new Error('Network failure'); });

      await expect(client.get('/down')).rejects.toThrow('Network failure');
    });
  });
});

describe('apiContext', () => {
  describe('Given context setters', () => {
    it('When setTenantId is called / Then getTenantId returns it', () => {
      apiContext.setTenantId('t1');
      expect(apiContext.getTenantId()).toBe('t1');
    });

    it('When setOrgId is called / Then getOrgId returns it', () => {
      apiContext.setOrgId('o1');
      expect(apiContext.getOrgId()).toBe('o1');
    });

    it('When setUserId is called / Then getUserId returns it', () => {
      apiContext.setUserId('u1');
      expect(apiContext.getUserId()).toBe('u1');
    });

    it('When setAccessToken is called / Then getAccessToken returns it', () => {
      apiContext.setAccessToken('tok');
      expect(apiContext.getAccessToken()).toBe('tok');
    });

    it('When setUser is called with full_name / Then getUserId returns user id', () => {
      apiContext.setUser({ id: 'u2', email: 'test@test.com', full_name: 'Test User' });
      expect(apiContext.getUserId()).toBe('u2');
    });

    it('When setUser is called without full_name / Then it falls back to email', () => {
      apiContext.setUser({ id: 'u3', email: 'fallback@test.com' });
      expect(apiContext.getUserId()).toBe('u3');
    });

    it('When getBaseUrl is called / Then it returns the configured base url', () => {
      expect(apiContext.getBaseUrl()).toBeDefined();
    });
  });

  describe('Given getHeadersRaw', () => {
    it('When access token is set / Then headers include Authorization', () => {
      apiContext.setAccessToken('my-token');
      apiContext.setTenantId('t1');
      apiContext.setOrgId('o1');
      const client = new ApiClient('http://test');
      const headers = client.getHeadersRaw();
      expect(headers['Authorization']).toBe('Bearer my-token');
      expect(headers['X-Tenant-Id']).toBe('t1');
      expect(headers['X-Org-Id']).toBe('o1');
    });
  });
});
