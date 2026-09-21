import { describe, it, expect, vi, beforeEach } from 'vitest';

// BDD specs for the read-only cross-module Timesheet bridge client.
// People Connect FE now routes timesheet reads through the People Connect BE
// (/timesheet-bridge/*) instead of calling the Timesheet BE directly. This
// eliminates the 403s caused by TimesheetV2Guard + PermissionsGuard blocking
// users who don't have Timesheet V2 feature-flagged.

// vi.hoisted ensures mockGet is available when the vi.mock() factory runs —
// in vitest 3.x, factories are called before module-body code executes, so
// bare const declarations referenced in factories are in the TDZ without hoisted().
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('./apiClient', () => ({
  api: {
    get: mockGet,
    getHeadersRaw: vi.fn(() => ({
      'X-Tenant-Id': 't1',
      'X-Org-Id': 'o1',
      Authorization: 'Bearer tok',
    })),
  },
}));

import { timesheetApi } from './timesheetApi';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Given timesheetApi.getEntries', () => {
  it('When called without params / Then it GETs the PC BE timesheet-bridge entries endpoint', async () => {
    mockGet.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });
    await timesheetApi.getEntries();
    expect(mockGet).toHaveBeenCalledTimes(1);
    const [path] = mockGet.mock.calls[0];
    expect(path).toBe('/timesheet-bridge/entries');
  });

  it('When called with filters / Then person_id, status and date range are forwarded', async () => {
    mockGet.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });
    await timesheetApi.getEntries({
      person_id: 'p1',
      status: 'approved',
      from_date: '2026-06-08',
      to_date: '2026-06-14',
      limit: 100,
    });
    const [path, params] = mockGet.mock.calls[0];
    expect(path).toBe('/timesheet-bridge/entries');
    expect(params).toMatchObject({
      person_id: 'p1',
      status: 'approved',
      from_date: '2026-06-08',
      to_date: '2026-06-14',
      limit: 100,
    });
  });

  it('When the BE returns entries / Then the parsed payload is returned as-is', async () => {
    const payload = {
      data: [{ id: 'e1', entry_date: '2026-06-09', hours: 8, status: 'approved' }],
      total: 1,
      limit: 50,
      offset: 0,
    };
    mockGet.mockResolvedValue(payload);
    const result = await timesheetApi.getEntries();
    expect(result).toEqual(payload);
  });

  it('When the BE throws / Then the error propagates to the caller', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'));
    await expect(timesheetApi.getEntries()).rejects.toThrow('Network Error');
  });
});

describe('Given timesheetApi.getUtilization', () => {
  it('When called with a range / Then it GETs the PC BE timesheet-bridge utilization endpoint', async () => {
    mockGet.mockResolvedValue({ people: [] });
    await timesheetApi.getUtilization({ from_date: '2026-06-08', to_date: '2026-06-14' });
    const [path, params] = mockGet.mock.calls[0];
    expect(path).toBe('/timesheet-bridge/utilization');
    expect(params).toMatchObject({ from_date: '2026-06-08', to_date: '2026-06-14' });
  });

  it('When called with person_ids / Then they are forwarded as a query param', async () => {
    mockGet.mockResolvedValue({ people: [] });
    await timesheetApi.getUtilization({ person_ids: 'p1,p2' });
    const [, params] = mockGet.mock.calls[0];
    expect(params).toMatchObject({ person_ids: 'p1,p2' });
  });

  it('When the BE returns people rollups / Then they are returned to the caller', async () => {
    const payload = {
      people: [
        { person_id: 'p1', total_hours: 40, approved_hours: 32, submitted_hours: 8, billable_hours: 30, approved_cost: 1600 },
      ],
    };
    mockGet.mockResolvedValue(payload);
    const result = await timesheetApi.getUtilization({ from_date: '2026-06-08', to_date: '2026-06-14' });
    expect(result.people).toHaveLength(1);
    expect(result.people[0].approved_cost).toBe(1600);
  });

  it('When the request fails / Then the error propagates', async () => {
    mockGet.mockRejectedValue(new Error('Timesheet service unavailable'));
    await expect(timesheetApi.getUtilization()).rejects.toThrow('Timesheet service unavailable');
  });
});

describe('Given the read-only contract of the timesheet client', () => {
  it('When inspecting the exported API / Then it exposes ONLY read methods (no create/update/delete/submit/approve/reject)', () => {
    expect(Object.keys(timesheetApi).sort()).toEqual(['getEntries', 'getUtilization']);
  });
});
