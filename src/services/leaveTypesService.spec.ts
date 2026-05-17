import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { leaveTypesApi } from './leaveTypesService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given leaveTypesApi.getAll', () => {
  it('When called without params / Then it calls GET /leave-types', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await leaveTypesApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/leave-types', undefined);
  });

  it('When called with is_active filter / Then the filter is passed', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await leaveTypesApi.getAll({ is_active: true });
    expect(mockApi.get).toHaveBeenCalledWith('/leave-types', { is_active: true });
  });
});

describe('Given leaveTypesApi.getById', () => {
  it('When called with id / Then it calls GET /leave-types/:id', async () => {
    mockApi.get.mockResolvedValue({ id: 'lt1', name: 'Annual Leave' });
    await leaveTypesApi.getById('lt1');
    expect(mockApi.get).toHaveBeenCalledWith('/leave-types/lt1');
  });
});

describe('Given leaveTypesApi.create', () => {
  it('When called with payload / Then it calls POST /leave-types', async () => {
    const payload = { code: 'AL', name: 'Annual Leave', is_paid: true, requires_approval: true, accrual_type: 'annual' as const, carry_forward_allowed: false };
    mockApi.post.mockResolvedValue({ id: 'lt1', ...payload });
    await leaveTypesApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/leave-types', payload);
  });

  it('When API resolves / Then the created leave type is returned', async () => {
    const payload = { code: 'SL', name: 'Sick Leave', is_paid: true, requires_approval: false, accrual_type: 'none' as const, carry_forward_allowed: false };
    mockApi.post.mockResolvedValue({ id: 'lt-new', ...payload });
    const result = await leaveTypesApi.create(payload);
    expect(result.id).toBe('lt-new');
    expect(result.name).toBe('Sick Leave');
  });
});

describe('Given leaveTypesApi.update', () => {
  it('When called with id and partial data / Then it calls PATCH /leave-types/:id', async () => {
    mockApi.patch.mockResolvedValue({ id: 'lt1', is_active: false });
    await leaveTypesApi.update('lt1', { is_active: false });
    expect(mockApi.patch).toHaveBeenCalledWith('/leave-types/lt1', { is_active: false });
  });
});

describe('Given leaveTypesApi.delete', () => {
  it('When called with id / Then it calls DELETE /leave-types/:id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Deleted' });
    await leaveTypesApi.delete('lt1');
    expect(mockApi.delete).toHaveBeenCalledWith('/leave-types/lt1');
  });
});
