import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { attendanceApi } from './attendanceService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given attendanceApi.getRegister', () => {
  it('When called with a date / Then it calls GET /attendance with the date param', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await attendanceApi.getRegister({ date: '2026-07-20' });
    expect(mockApi.get).toHaveBeenCalledWith('/attendance', { date: '2026-07-20' });
  });

  it('When called with filters / Then department_id/status/person_id/page/limit are forwarded', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0, page: 2, limit: 50 });
    await attendanceApi.getRegister({
      date: '2026-07-20',
      department_id: 'd1',
      status: 'present',
      person_id: 'p1',
      page: 2,
      limit: 50,
    });
    expect(mockApi.get).toHaveBeenCalledWith('/attendance', {
      date: '2026-07-20',
      department_id: 'd1',
      status: 'present',
      person_id: 'p1',
      page: 2,
      limit: 50,
    });
  });
});

describe('Given attendanceApi.getSummary', () => {
  it('When called with a date / Then it calls GET /attendance/summary with the date param', async () => {
    mockApi.get.mockResolvedValue({ total_employees: 10, present: 8, absent: 1, on_leave: 1, half_day: 0, remote: 0 });
    await attendanceApi.getSummary('2026-07-20');
    expect(mockApi.get).toHaveBeenCalledWith('/attendance/summary', { date: '2026-07-20' });
  });
});

describe('Given attendanceApi.mark', () => {
  it('When called with a payload / Then it calls POST /attendance with that payload', async () => {
    const payload = { person_id: 'p1', attendance_date: '2026-07-20', status: 'present' as const };
    mockApi.post.mockResolvedValue({ id: 'a1', ...payload, check_in: null, check_out: null, notes: null });
    await attendanceApi.mark(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/attendance', payload);
  });
});

describe('Given attendanceApi.update', () => {
  it('When called with id and payload / Then it calls PATCH /attendance/:id with the reason included', async () => {
    const payload = { status: 'half_day' as const, reason: 'Left early for appointment' };
    mockApi.patch.mockResolvedValue({ id: 'a1', person_id: 'p1', attendance_date: '2026-07-20', status: 'half_day', check_in: null, check_out: null, notes: null });
    await attendanceApi.update('a1', payload);
    expect(mockApi.patch).toHaveBeenCalledWith('/attendance/a1', payload);
  });
});

describe('Given attendanceApi.delete', () => {
  it('When called with id / Then it calls DELETE /attendance/:id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'deleted' });
    await attendanceApi.delete('a1');
    expect(mockApi.delete).toHaveBeenCalledWith('/attendance/a1');
  });
});

describe('Given attendanceApi.getHistory', () => {
  it('When called with id / Then it calls GET /attendance/:id/history and returns the {data, total} shape', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    const result = await attendanceApi.getHistory('a1');
    expect(mockApi.get).toHaveBeenCalledWith('/attendance/a1/history');
    expect(result).toEqual({ data: [], total: 0 });
  });
});
