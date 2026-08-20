import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * meService — BDD specs.
 *
 * The client's job is to hit /me/* and never name a person. These specs pin
 * the endpoint each call uses, because a slip back to an admin endpoint
 * (/leave-requests instead of /me/leave/requests) would silently restore
 * org-wide reads without any visible symptom.
 */

vi.mock('./apiClient', () => ({
    api: {
        get: vi.fn().mockResolvedValue({ data: [] }),
        post: vi.fn().mockResolvedValue({}),
        patch: vi.fn().mockResolvedValue({}),
    },
}));

import { meService } from './meService';
import { api } from './apiClient';

beforeEach(() => vi.clearAllMocks());

describe('Given the self-service reads', () => {
    it.each([
        ['myLeaveRequests', () => meService.myLeaveRequests(), '/me/leave/requests'],
        ['myLeaveBalances', () => meService.myLeaveBalances(), '/me/leave/balances'],
        ['myGoals', () => meService.myGoals(), '/me/goals'],
        ['myAttendance', () => meService.myAttendance(), '/me/attendance'],
        ['myOpenSession', () => meService.myOpenSession(), '/me/session'],
        ['directory', () => meService.directory(), '/me/team/directory'],
    ])('When %s is called / Then it hits the self-scoped endpoint', async (_n, call, endpoint) => {
        await call();
        // Only the endpoint is asserted: myOpenSession takes no params object
        // at all, while the others pass an explicit undefined.
        expect((api.get as any).mock.calls[0][0]).toBe(endpoint);
    });

    it('When whosOut is called / Then the date window is passed', async () => {
        await meService.whosOut('2026-09-01', '2026-09-30');

        expect(api.get).toHaveBeenCalledWith('/me/team/whos-out', {
            from: '2026-09-01',
            to: '2026-09-30',
        });
    });

    it('When a fiscal year is given / Then it is passed as a param', async () => {
        await meService.myLeaveBalances(2026);
        expect(api.get).toHaveBeenCalledWith('/me/leave/balances', { fiscal_year: 2026 });
    });

    it('When filters are given / Then they are forwarded', async () => {
        await meService.myLeaveRequests({ status: 'pending', limit: 5 });
        expect(api.get).toHaveBeenCalledWith('/me/leave/requests', {
            status: 'pending',
            limit: 5,
        });

        await meService.myGoals({ status: 'active' });
        expect(api.get).toHaveBeenCalledWith('/me/goals', { status: 'active' });

        await meService.directory({ search: 'zoe', department_id: 'd1' });
        expect(api.get).toHaveBeenCalledWith('/me/team/directory', {
            search: 'zoe',
            department_id: 'd1',
        });
    });
});

describe('Given the self-service writes', () => {
    it('When leave is requested / Then no person_id is in the payload', async () => {
        await meService.requestLeave({
            leave_type_id: 'lt-1',
            start_date: '2026-09-01',
            end_date: '2026-09-02',
        });

        const [endpoint, payload] = (api.post as any).mock.calls[0];
        expect(endpoint).toBe('/me/leave/requests');
        expect(payload).not.toHaveProperty('person_id');
    });

    it.each([
        ['clockOut', () => meService.clockOut(), '/me/session/clock-out'],
        ['startBreak', () => meService.startBreak(), '/me/session/break/start'],
        ['endBreak', () => meService.endBreak(), '/me/session/break/end'],
    ])('When %s is called / Then it posts an empty body to the self-scoped route', async (_n, call, endpoint) => {
        await call();
        expect(api.post).toHaveBeenCalledWith(endpoint, {});
    });

    it('When clocking in / Then only the work unit is sent, never a person', async () => {
        await meService.clockIn({ entity_type: 'project_task', entity_id: 'e-1' });

        const [endpoint, payload] = (api.post as any).mock.calls[0];
        expect(endpoint).toBe('/me/session/clock-in');
        expect(payload).not.toHaveProperty('person_id');
        expect(payload.entity_id).toBe('e-1');
    });

    it('When the profile is patched / Then it goes to the self-service route', async () => {
        await meService.updateMyProfile({ phone: '+1' });
        expect(api.patch).toHaveBeenCalledWith('/me/profile', { phone: '+1' });
    });
});

describe('Given the module surface as a whole', () => {
    it('When every method is inspected / Then none targets an admin endpoint', async () => {
        // A regression here is invisible at runtime — the page still renders,
        // it just shows the whole organisation again.
        const calls: string[] = [];
        (api.get as any).mockImplementation((e: string) => { calls.push(e); return Promise.resolve({ data: [] }); });
        (api.post as any).mockImplementation((e: string) => { calls.push(e); return Promise.resolve({}); });
        (api.patch as any).mockImplementation((e: string) => { calls.push(e); return Promise.resolve({}); });

        await Promise.all([
            meService.myLeaveRequests(),
            meService.myLeaveBalances(),
            meService.myGoals(),
            meService.myAttendance(),
            meService.myOpenSession(),
            meService.directory(),
            meService.whosOut('2026-01-01', '2026-01-02'),
            meService.requestLeave({ leave_type_id: 'lt-1', start_date: 'a', end_date: 'b' }),
            meService.clockIn({ entity_type: 't', entity_id: 'e' }),
            meService.clockOut(),
            meService.startBreak(),
            meService.endBreak(),
            meService.updateMyProfile({ phone: '+1' }),
        ]);

        expect(calls).toHaveLength(13);
        expect(calls.every(c => c.startsWith('/me/'))).toBe(true);
    });
});
