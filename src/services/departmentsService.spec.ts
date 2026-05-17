import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { departmentsApi } from './departmentsService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given departmentsApi.getAll', () => {
  it('When called without params / Then it calls GET /departments', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await departmentsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/departments', undefined);
  });

  it('When called with is_active filter / Then it passes the param', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await departmentsApi.getAll({ is_active: true });
    expect(mockApi.get).toHaveBeenCalledWith('/departments', { is_active: true });
  });
});

describe('Given departmentsApi.getTree', () => {
  it('When called / Then it calls GET /departments/tree', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await departmentsApi.getTree();
    expect(mockApi.get).toHaveBeenCalledWith('/departments/tree');
  });

  it('When API resolves / Then it returns the data array', async () => {
    const mockTree = { data: [{ id: 'd1', name: 'Engineering', children: [] }] };
    mockApi.get.mockResolvedValue(mockTree);
    const result = await departmentsApi.getTree();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Engineering');
  });
});

describe('Given departmentsApi.create', () => {
  it('When called with payload / Then it calls POST /departments', async () => {
    const payload = { code: 'ENG', name: 'Engineering' };
    mockApi.post.mockResolvedValue({ id: 'd1', ...payload });
    await departmentsApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/departments', payload);
  });
});

describe('Given departmentsApi.update', () => {
  it('When called with id and data / Then it calls PATCH /departments/:id', async () => {
    mockApi.patch.mockResolvedValue({ id: 'd1', name: 'Updated Eng' });
    await departmentsApi.update('d1', { name: 'Updated Eng' });
    expect(mockApi.patch).toHaveBeenCalledWith('/departments/d1', { name: 'Updated Eng' });
  });
});

describe('Given departmentsApi.delete', () => {
  it('When called with id / Then it calls DELETE /departments/:id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Deleted' });
    await departmentsApi.delete('d1');
    expect(mockApi.delete).toHaveBeenCalledWith('/departments/d1');
  });

  it('When delete succeeds / Then it returns a message object', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Department deleted successfully' });
    const result = await departmentsApi.delete('d1');
    expect(result.message).toBe('Department deleted successfully');
  });
});

describe('Given departmentsApi.getById', () => {
  it('When called with id / Then it calls GET /departments/:id', async () => {
    mockApi.get.mockResolvedValue({ id: 'd1', name: 'Engineering' });
    await departmentsApi.getById('d1');
    expect(mockApi.get).toHaveBeenCalledWith('/departments/d1');
  });
});
