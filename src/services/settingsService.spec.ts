import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./apiClient', () => ({
    apiContext: {
        getAccessToken: vi.fn().mockReturnValue('mock-token'),
        getTenantId: vi.fn().mockReturnValue('tenant-1'),
        getOrgId: vi.fn().mockReturnValue('org-1'),
        setTenantId: vi.fn(),
        setOrgId: vi.fn(),
        setAccessToken: vi.fn(),
    },
}));

import { fetchOrgBaseCurrency } from './settingsService';

const mockFetch = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const ok = (body: object) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

const notOk = (status: number) =>
    Promise.resolve({ ok: false, status } as Response);

describe('fetchOrgBaseCurrency', () => {
    describe('Given the org has base_currency configured', () => {
        it('When fetchOrgBaseCurrency is called / Then it returns the base_currency value', async () => {
            mockFetch.mockReturnValue(ok({ base_currency: 'INR', timezone: 'Asia/Kolkata' }));

            const result = await fetchOrgBaseCurrency('org-123');

            expect(result).toBe('INR');
        });

        it('When fetchOrgBaseCurrency is called / Then it sends the correct auth and org headers', async () => {
            mockFetch.mockReturnValue(ok({ base_currency: 'INR' }));

            await fetchOrgBaseCurrency('org-123');

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('/v1/business-settings/org-123');
            expect((options as RequestInit).headers).toMatchObject({
                'X-Org-Id': 'org-123',
                'X-Tenant-Id': 'tenant-1',
                'Authorization': 'Bearer mock-token',
            });
        });
    });

    describe('Given the org has only legacy currency field (no base_currency)', () => {
        it('When fetchOrgBaseCurrency is called / Then it falls back to the currency field', async () => {
            mockFetch.mockReturnValue(ok({ currency: 'AED' }));

            const result = await fetchOrgBaseCurrency('org-123');

            expect(result).toBe('AED');
        });
    });

    describe('Given the org has both base_currency and currency fields', () => {
        it('When fetchOrgBaseCurrency is called / Then base_currency takes precedence over currency', async () => {
            mockFetch.mockReturnValue(ok({ base_currency: 'EUR', currency: 'USD' }));

            const result = await fetchOrgBaseCurrency('org-123');

            expect(result).toBe('EUR');
        });
    });

    describe('Given the settings response has no currency fields', () => {
        it('When fetchOrgBaseCurrency is called / Then it returns null', async () => {
            mockFetch.mockReturnValue(ok({ timezone: 'UTC' }));

            const result = await fetchOrgBaseCurrency('org-123');

            expect(result).toBeNull();
        });
    });

    describe('Given the Core BE returns a non-ok response', () => {
        it('When fetchOrgBaseCurrency receives a 404 / Then it returns null without throwing', async () => {
            mockFetch.mockReturnValue(notOk(404));

            const result = await fetchOrgBaseCurrency('org-123');

            expect(result).toBeNull();
        });

        it('When fetchOrgBaseCurrency receives a 500 / Then it returns null without throwing', async () => {
            mockFetch.mockReturnValue(notOk(500));

            const result = await fetchOrgBaseCurrency('org-123');

            expect(result).toBeNull();
        });
    });

    describe('Given the network request fails', () => {
        it('When fetch throws a network error / Then fetchOrgBaseCurrency returns null without throwing', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await fetchOrgBaseCurrency('org-123');

            expect(result).toBeNull();
        });
    });

    describe('Given no access token is available', () => {
        it('When fetchOrgBaseCurrency is called / Then it omits the Authorization header gracefully', async () => {
            const { apiContext } = await import('./apiClient');
            vi.mocked(apiContext.getAccessToken).mockReturnValueOnce('');
            mockFetch.mockReturnValue(ok({ base_currency: 'GBP' }));

            const result = await fetchOrgBaseCurrency('org-456');

            expect(result).toBe('GBP');
            const [, options] = mockFetch.mock.calls[0];
            expect((options as RequestInit).headers).not.toHaveProperty('Authorization');
        });
    });
});
