import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// BDD specs for the read-only cross-module Timesheet client.
// People Connect consumes timesheet data from the Timesheets module (port 3012)
// and never mutates it — this client only exposes GET calls.

vi.mock('./apiClient', () => ({
  api: {
    getHeadersRaw: vi.fn(() => ({
      'X-Tenant-Id': 't1',
      'X-Org-Id': 'o1',
      'X-User-Id': 'u1',
      Authorization: 'Bearer tok',
    })),
  },
}));

import { timesheetApi } from './timesheetApi';
import { api } from './apiClient';

const mockFetch = vi.fn();

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});

const errorResponse = (status: number, body: string) => ({
  ok: false,
  status,
  text: async () => body,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Given timesheetApi.getEntries', () => {
  it('When called without params / Then it GETs the time-logging entries endpoint of the Timesheet BE', async () => {
    mockFetch.mockResolvedValue(okResponse({ data: [], total: 0, limit: 50, offset: 0 }));
    await timesheetApi.getEntries();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v2/timesheet/time-logging/entries');
    expect(options.method).toBe('GET');
  });

  it('When called with filters / Then person_id, status and date range are passed as query params', async () => {
    mockFetch.mockResolvedValue(okResponse({ data: [], total: 0, limit: 50, offset: 0 }));
    await timesheetApi.getEntries({
      person_id: 'p1',
      status: 'approved',
      from_date: '2026-06-08',
      to_date: '2026-06-14',
      limit: 100,
    });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('person_id=p1');
    expect(url).toContain('status=approved');
    expect(url).toContain('from_date=2026-06-08');
    expect(url).toContain('to_date=2026-06-14');
    expect(url).toContain('limit=100');
  });

  it('When params are empty/undefined / Then they are omitted from the query string', async () => {
    mockFetch.mockResolvedValue(okResponse({ data: [], total: 0, limit: 50, offset: 0 }));
    await timesheetApi.getEntries({ person_id: '', status: undefined, from_date: '2026-06-08' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain('person_id');
    expect(url).not.toContain('status');
    expect(url).toContain('from_date=2026-06-08');
  });

  it('When called / Then it sends tenant/org/auth headers from the shared apiClient context', async () => {
    mockFetch.mockResolvedValue(okResponse({ data: [], total: 0, limit: 50, offset: 0 }));
    await timesheetApi.getEntries();
    expect((api as any).getHeadersRaw).toHaveBeenCalled();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Tenant-Id': 't1',
      'X-Org-Id': 'o1',
      Authorization: 'Bearer tok',
    });
  });

  it('When the BE returns entries / Then the parsed payload is returned as-is', async () => {
    const payload = {
      data: [{ id: 'e1', entry_date: '2026-06-09', hours: 8, status: 'approved' }],
      total: 1,
      limit: 50,
      offset: 0,
    };
    mockFetch.mockResolvedValue(okResponse(payload));
    const result = await timesheetApi.getEntries();
    expect(result).toEqual(payload);
  });

  it('When the BE returns a JSON error / Then the error message is surfaced', async () => {
    mockFetch.mockResolvedValue(errorResponse(403, JSON.stringify({ message: 'Forbidden tenant' })));
    await expect(timesheetApi.getEntries()).rejects.toThrow('Forbidden tenant');
  });

  it('When the BE returns a non-JSON error / Then the raw text is surfaced', async () => {
    mockFetch.mockResolvedValue(errorResponse(500, 'Internal Server Error'));
    await expect(timesheetApi.getEntries()).rejects.toThrow('Internal Server Error');
  });

  it('When the BE returns invalid JSON with 200 / Then an Invalid JSON error is thrown', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => '<html>oops</html>' });
    await expect(timesheetApi.getEntries()).rejects.toThrow(/Invalid JSON response/);
  });
});

describe('Given timesheetApi.getUtilization', () => {
  it('When called with a range / Then it GETs the utilization endpoint with from/to dates', async () => {
    mockFetch.mockResolvedValue(okResponse({ people: [] }));
    await timesheetApi.getUtilization({ from_date: '2026-06-08', to_date: '2026-06-14' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v2/timesheet/time-logging/utilization');
    expect(url).toContain('from_date=2026-06-08');
    expect(url).toContain('to_date=2026-06-14');
  });

  it('When called with person_ids / Then they are forwarded as a query param', async () => {
    mockFetch.mockResolvedValue(okResponse({ people: [] }));
    await timesheetApi.getUtilization({ person_ids: 'p1' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('person_ids=p1');
  });

  it('When the BE returns people rollups / Then they are returned to the caller', async () => {
    const payload = {
      people: [
        { person_id: 'p1', total_hours: 40, approved_hours: 32, submitted_hours: 8, billable_hours: 30, approved_cost: 1600 },
      ],
    };
    mockFetch.mockResolvedValue(okResponse(payload));
    const result = await timesheetApi.getUtilization({ from_date: '2026-06-08', to_date: '2026-06-14' });
    expect(result.people).toHaveLength(1);
    expect(result.people[0].approved_cost).toBe(1600);
  });

  it('When the request fails with a default error body / Then a Timesheet API error is thrown', async () => {
    mockFetch.mockResolvedValue(errorResponse(502, ''));
    await expect(timesheetApi.getUtilization()).rejects.toThrow('Timesheet API Error: 502');
  });
});

describe('Given the read-only contract of the timesheet client', () => {
  it('When inspecting the exported API / Then it exposes ONLY read methods (no create/update/delete/submit/approve/reject)', () => {
    expect(Object.keys(timesheetApi).sort()).toEqual(['getEntries', 'getUtilization']);
  });

  it('When any call is made / Then the HTTP method is always GET', async () => {
    mockFetch.mockResolvedValue(okResponse({ data: [], total: 0, limit: 50, offset: 0 }));
    await timesheetApi.getEntries();
    mockFetch.mockResolvedValue(okResponse({ people: [] }));
    await timesheetApi.getUtilization();
    for (const call of mockFetch.mock.calls) {
      expect(call[1].method).toBe('GET');
    }
  });
});
