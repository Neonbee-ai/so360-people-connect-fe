import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { holidaysApi } from './holidaysService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given holidaysApi.getAll', () => {
  it('When called with no filters / Then it calls GET /holidays with an empty filter object', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await holidaysApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/holidays', {});
  });

  it('When called with a year filter / Then it forwards the year to GET /holidays', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await holidaysApi.getAll({ year: '2026' });
    expect(mockApi.get).toHaveBeenCalledWith('/holidays', { year: '2026' });
  });

  it('When called / Then returns the data from the response', async () => {
    const holidays = [{ id: 'h1', name: 'Republic Day', holiday_date: '2026-01-26' }];
    mockApi.get.mockResolvedValue({ data: holidays });
    const result = await holidaysApi.getAll({ year: '2026' });
    expect(result.data).toEqual(holidays);
  });
});

describe('Given holidaysApi.create', () => {
  it('When called with DTO / Then it calls POST /holidays', async () => {
    const dto = { name: 'Diwali', holiday_date: '2026-11-08' };
    mockApi.post.mockResolvedValue({ id: 'h-new', ...dto });
    await holidaysApi.create(dto);
    expect(mockApi.post).toHaveBeenCalledWith('/holidays', dto);
  });
});

describe('Given holidaysApi.update', () => {
  it('When called with id and DTO / Then it calls PATCH /holidays/:id', async () => {
    mockApi.patch.mockResolvedValue({ id: 'h1', name: 'Updated' });
    await holidaysApi.update('h1', { name: 'Updated' });
    expect(mockApi.patch).toHaveBeenCalledWith('/holidays/h1', { name: 'Updated' });
  });
});

describe('Given holidaysApi.delete', () => {
  it('When called with id / Then it calls DELETE /holidays/:id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Holiday deleted' });
    await holidaysApi.delete('h1');
    expect(mockApi.delete).toHaveBeenCalledWith('/holidays/h1');
  });
});
