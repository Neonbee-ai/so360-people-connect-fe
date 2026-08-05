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

import { departmentScopeApi } from './departmentScopeService';

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

const notOk = (status: number, body: object = {}) =>
    Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) } as Response);

describe('departmentScopeApi.listForDepartment', () => {
    it('When Core returns grantees / Then returns the scopes array', async () => {
        const scopes = [{ id: 's1', user_id: 'u1', include_descendants: true, user_email: 'a@test.com', user_full_name: 'A' }];
        mockFetch.mockReturnValue(ok({ org_id: 'org-1', department_id: 'd1', scopes }));

        const result = await departmentScopeApi.listForDepartment('org-1', 'd1');

        expect(result).toEqual(scopes);
    });

    it('When called / Then hits the by-department endpoint with tenant/org/auth headers', async () => {
        mockFetch.mockReturnValue(ok({ scopes: [] }));

        await departmentScopeApi.listForDepartment('org-1', 'd1');

        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toContain('/v1/iam/user-department-scopes/by-department/org-1/d1');
        expect((options as RequestInit).headers).toMatchObject({
            'X-Org-Id': 'org-1',
            'X-Tenant-Id': 'tenant-1',
            'Authorization': 'Bearer mock-token',
        });
    });

    it('When Core returns no scopes key / Then returns an empty array', async () => {
        mockFetch.mockReturnValue(ok({}));
        const result = await departmentScopeApi.listForDepartment('org-1', 'd1');
        expect(result).toEqual([]);
    });

    it('When Core returns a non-ok response / Then throws with the backend message', async () => {
        mockFetch.mockReturnValue(notOk(403, { message: 'Forbidden' }));
        await expect(departmentScopeApi.listForDepartment('org-1', 'd1')).rejects.toThrow('Forbidden');
    });
});

describe('departmentScopeApi.grant', () => {
    it('When called / Then POSTs the payload to user-department-scopes', async () => {
        mockFetch.mockReturnValue(ok({}));

        await departmentScopeApi.grant({
            user_id: 'u1',
            org_id: 'org-1',
            department_id: 'd1',
            include_descendants: false,
        });

        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toContain('/v1/iam/user-department-scopes');
        expect((options as RequestInit).method).toBe('POST');
        expect(JSON.parse((options as RequestInit).body as string)).toEqual({
            user_id: 'u1',
            org_id: 'org-1',
            department_id: 'd1',
            include_descendants: false,
        });
    });

    it('When Core rejects the grant / Then throws with the backend message', async () => {
        mockFetch.mockReturnValue(notOk(400, { message: 'department_id is required' }));
        await expect(
            departmentScopeApi.grant({ user_id: 'u1', org_id: 'org-1', department_id: '' }),
        ).rejects.toThrow('department_id is required');
    });
});

describe('departmentScopeApi.revoke', () => {
    it('When called / Then DELETEs the scope with org_id as a query param', async () => {
        mockFetch.mockReturnValue(ok({ revoked: true }));

        await departmentScopeApi.revoke('scope-1', 'org-1');

        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toContain('/v1/iam/user-department-scopes/scope-1?org_id=org-1');
        expect((options as RequestInit).method).toBe('DELETE');
    });

    it('When Core rejects the revoke / Then throws', async () => {
        mockFetch.mockReturnValue(notOk(403, { message: 'Forbidden' }));
        await expect(departmentScopeApi.revoke('scope-1', 'org-1')).rejects.toThrow('Forbidden');
    });
});
