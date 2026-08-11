import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { shiftsApi } from './shiftsService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given shiftsApi.getAll', () => {
  it('When called / Then it calls GET /shifts', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await shiftsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/shifts');
  });

  it('When called / Then returns the data from the response', async () => {
    const shifts = [{ id: 's1', name: 'Morning', start_time: '09:00', end_time: '18:00' }];
    mockApi.get.mockResolvedValue({ data: shifts });
    const result = await shiftsApi.getAll();
    expect(result.data).toEqual(shifts);
  });
});

describe('Given shiftsApi.create', () => {
  it('When called with DTO / Then it calls POST /shifts', async () => {
    const dto = { name: 'Night', start_time: '22:00', end_time: '06:00', is_night_shift: true };
    mockApi.post.mockResolvedValue({ id: 's-new', ...dto });
    await shiftsApi.create(dto);
    expect(mockApi.post).toHaveBeenCalledWith('/shifts', dto);
  });
});

describe('Given shiftsApi.update', () => {
  it('When called with id and DTO / Then it calls PATCH /shifts/:id', async () => {
    mockApi.patch.mockResolvedValue({ id: 's1', name: 'Updated' });
    await shiftsApi.update('s1', { name: 'Updated' });
    expect(mockApi.patch).toHaveBeenCalledWith('/shifts/s1', { name: 'Updated' });
  });
});

describe('Given shiftsApi.delete', () => {
  it('When called with id / Then it calls DELETE /shifts/:id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Shift deleted' });
    await shiftsApi.delete('s1');
    expect(mockApi.delete).toHaveBeenCalledWith('/shifts/s1');
  });
});
