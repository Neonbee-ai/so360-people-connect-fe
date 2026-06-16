import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { workLocationsApi } from './workLocationsService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

// The controller was renamed from @Controller('people/locations') to
// @Controller('locations') so the API gateway prefix /people/* strips cleanly.
// Every method MUST use /locations (not /people/locations).

describe('Given workLocationsApi.getAll', () => {
  it('When called / Then it calls GET /locations (not /people/locations)', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await workLocationsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/locations');
    // Verify the old double-prefix path is NOT used
    expect(mockApi.get).not.toHaveBeenCalledWith('/people/locations');
  });

  it('When called / Then returns the data from the response', async () => {
    const locations = [{ id: 'loc-1', name: 'HQ', location_type: 'office', is_active: true }];
    mockApi.get.mockResolvedValue({ data: locations });
    const result = await workLocationsApi.getAll();
    expect(result.data).toEqual(locations);
  });
});

describe('Given workLocationsApi.create', () => {
  it('When called with DTO / Then it calls POST /locations', async () => {
    const dto = { name: 'Remote Office', location_type: 'remote' as const };
    mockApi.post.mockResolvedValue({ id: 'loc-new', ...dto });
    await workLocationsApi.create(dto);
    expect(mockApi.post).toHaveBeenCalledWith('/locations', dto);
    expect(mockApi.post).not.toHaveBeenCalledWith('/people/locations', expect.anything());
  });
});

describe('Given workLocationsApi.update', () => {
  it('When called with id and DTO / Then it calls PATCH /locations/:id', async () => {
    mockApi.patch.mockResolvedValue({ id: 'loc-1', name: 'Updated HQ' });
    await workLocationsApi.update('loc-1', { name: 'Updated HQ' });
    expect(mockApi.patch).toHaveBeenCalledWith('/locations/loc-1', { name: 'Updated HQ' });
    expect(mockApi.patch).not.toHaveBeenCalledWith('/people/locations/loc-1', expect.anything());
  });
});

describe('Given workLocationsApi.delete', () => {
  it('When called with id / Then it calls DELETE /locations/:id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Work location deactivated' });
    await workLocationsApi.delete('loc-1');
    expect(mockApi.delete).toHaveBeenCalledWith('/locations/loc-1');
    expect(mockApi.delete).not.toHaveBeenCalledWith('/people/locations/loc-1');
  });
});
