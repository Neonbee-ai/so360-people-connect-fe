import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiContext } from './apiClient';
import { peopleApi } from './peopleService';
import { fetchOrgBaseCurrency } from './settingsService';

/**
 * BDD: the People Connect API client surfaces a 402 (quota exceeded) to the
 * Shell's upgrade modal through the shared `__so360_quota_exceeded` event, and
 * stays silent for every other failure status.
 */
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Feature: quota-exceeded interceptor on the People Connect API client', () => {
  let received: CustomEvent[];
  const listener = (e: Event) => { received.push(e as CustomEvent); };

  beforeEach(() => {
    received = [];
    apiContext.setTenantId('tenant-1');
    apiContext.setOrgId('org-1');
    apiContext.setAccessToken('token');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('__so360_quota_exceeded', listener);
  });
  afterEach(() => {
    window.removeEventListener('__so360_quota_exceeded', listener);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Given the backend answers 402 with a resolution hint', () => {
    it('When api.request runs / Then __so360_quota_exceeded is dispatched with the resolution and the call still rejects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(402, {
        message: 'Quota exceeded', resolution: { action: 'upgrade', plan: 'growth' },
      })));

      await expect(peopleApi.getAll()).rejects.toThrow('Quota exceeded');

      expect(received).toHaveLength(1);
      expect(received[0].detail).toEqual({ action: 'upgrade', plan: 'growth' });
    });
  });

  describe('Given the backend answers 402 without a resolution', () => {
    it('When the direct Core business-settings lookup runs / Then the raw body is the event detail and the lookup degrades to null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(402, { code: 'QUOTA_EXCEEDED' })));

      await expect(fetchOrgBaseCurrency('org-1')).resolves.toBeNull();

      expect(received).toHaveLength(1);
      expect(received[0].detail).toEqual({ code: 'QUOTA_EXCEEDED' });
    });
  });

  describe('Given the backend answers 500', () => {
    it('When api.request runs / Then no quota event is dispatched and the error propagates', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { message: 'boom' })));

      await expect(peopleApi.getAll()).rejects.toThrow('boom');

      expect(received).toHaveLength(0);
    });
  });
});
