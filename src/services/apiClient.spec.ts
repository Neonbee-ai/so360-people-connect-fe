import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, apiContext } from './apiClient';

beforeEach(() => {
  vi.resetAllMocks();
  apiContext.setTenantId('');
  apiContext.setOrgId('');
  apiContext.setAccessToken('');
  apiContext.setAccessTokenProvider(null);
});

describe('Given ApiClient with tenant context set', () => {
  it('When GET is called / Then the request includes X-Tenant-Id header', async () => {
    apiContext.setTenantId('t-123');
    const client = new ApiClient('/test-api');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"result":"ok"}'),
    });
    vi.stubGlobal('fetch', fetchMock);
    await client.get('/test');
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Tenant-Id']).toBe('t-123');
  });

  it('When GET is called with params / Then query string is appended', async () => {
    const client = new ApiClient('/test-api');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    }));
    await client.get('/people', { status: 'active', page: 1 });
    const calledUrl = (fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=active');
    expect(calledUrl).toContain('page=1');
  });

  it('When access token is set / Then Authorization header is included', async () => {
    apiContext.setAccessToken('bearer-token');
    const client = new ApiClient('/test-api');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });
    vi.stubGlobal('fetch', fetchMock);
    await client.get('/endpoint');
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer bearer-token');
  });

  it('When no access token is set / Then Authorization header is absent', async () => {
    const client = new ApiClient('/test-api');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });
    vi.stubGlobal('fetch', fetchMock);
    await client.get('/endpoint');
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('Given a live access-token provider (token rotation)', () => {
  const callHeaders = async (method: 'get' | 'patch') => {
    const client = new ApiClient('/test-api');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') });
    vi.stubGlobal('fetch', fetchMock);
    if (method === 'get') await client.get('/endpoint');
    else await client.patch('/endpoint/1', { a: 1 });
    return fetchMock.mock.calls[0][1].headers;
  };

  it('When a provider is registered / Then each request resolves the freshest token', async () => {
    let current = 'token-1';
    apiContext.setAccessTokenProvider(() => current);

    let headers = await callHeaders('get');
    expect(headers['Authorization']).toBe('Bearer token-1');

    // Shell rotates the JWT — the next request must pick up the new token
    // without setAccessToken being called again.
    current = 'token-2';
    headers = await callHeaders('patch');
    expect(headers['Authorization']).toBe('Bearer token-2');
  });

  it('When the provider returns the live token / Then it overrides a previously cached stale token', async () => {
    // Simulate the original bug: a stale token was cached once.
    apiContext.setAccessToken('stale-token');
    apiContext.setAccessTokenProvider(() => 'fresh-token');
    const headers = await callHeaders('patch');
    expect(headers['Authorization']).toBe('Bearer fresh-token');
  });

  it('When the provider returns empty / Then it falls back to the cached token', async () => {
    apiContext.setAccessToken('cached-token');
    apiContext.setAccessTokenProvider(() => '');
    const headers = await callHeaders('get');
    expect(headers['Authorization']).toBe('Bearer cached-token');
  });
});

describe('Given ApiClient receiving error responses', () => {
  it('When response is not ok / Then it throws an error with API status', async () => {
    const client = new ApiClient('/test-api');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('{"message":"Unauthorized"}'),
    }));
    await expect(client.get('/protected')).rejects.toThrow('Unauthorized');
  });

  it('When response JSON is invalid / Then it throws an error', async () => {
    const client = new ApiClient('/test-api');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('not-valid-json'),
    }));
    await expect(client.get('/broken')).rejects.toThrow('Invalid JSON response');
  });
});

describe('Given ApiClient POST and PATCH methods', () => {
  it('When POST is called / Then it sends method POST with body', async () => {
    const client = new ApiClient('/test-api');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"id":"new"}'),
    });
    vi.stubGlobal('fetch', fetchMock);
    await client.post('/people', { full_name: 'Bob' });
    const options = fetchMock.mock.calls[0][1];
    expect(options.method).toBe('POST');
    expect(options.body).toContain('Bob');
  });

  it('When PATCH is called / Then it sends method PATCH', async () => {
    const client = new ApiClient('/test-api');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });
    vi.stubGlobal('fetch', fetchMock);
    await client.patch('/people/1', { status: 'inactive' });
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });
});

describe('Given apiContext setters and getters', () => {
  it('When setTenantId is called / Then getTenantId returns the same value', () => {
    apiContext.setTenantId('tenant-xyz');
    expect(apiContext.getTenantId()).toBe('tenant-xyz');
  });

  it('When setUser is called / Then userId is set from user.id', () => {
    apiContext.setUser({ id: 'u99', email: 'test@test.com', full_name: 'Test User' });
    expect(apiContext.getUserId()).toBe('u99');
  });
});
