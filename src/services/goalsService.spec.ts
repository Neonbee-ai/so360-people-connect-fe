import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { goalsApi } from './goalsService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given goalsApi.getAll', () => {
  it('When called without params / Then it calls GET /goals', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await goalsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/goals', undefined);
  });

  it('When called with person_id and status / Then it passes all filters', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await goalsApi.getAll({ person_id: 'p1', status: 'in_progress' });
    expect(mockApi.get).toHaveBeenCalledWith('/goals', { person_id: 'p1', status: 'in_progress' });
  });
});

describe('Given goalsApi.create', () => {
  it('When called with payload / Then it calls POST /goals', async () => {
    const payload = {
      person_id: 'p1',
      title: 'Increase sales',
      goal_type: 'individual' as const,
      target_date: '2024-12-31',
      priority: 'high' as const,
    };
    mockApi.post.mockResolvedValue({ id: 'g1', ...payload });
    await goalsApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/goals', payload);
  });
});

describe('Given goalsApi.update', () => {
  it('When called with id and partial data / Then it calls PATCH /goals/:id', async () => {
    mockApi.patch.mockResolvedValue({ id: 'g1', status: 'completed' });
    await goalsApi.update('g1', { status: 'completed' });
    expect(mockApi.patch).toHaveBeenCalledWith('/goals/g1', { status: 'completed' });
  });
});

describe('Given goalsApi.updateProgress', () => {
  it('When called with currentValue and targetValue / Then it PATCHes /goals/:id/progress with computed percentage', async () => {
    mockApi.patch.mockResolvedValue({ id: 'g1', current_value: 750, progress_percentage: 75 });
    await goalsApi.updateProgress('g1', 750, 1000);
    expect(mockApi.patch).toHaveBeenCalledWith('/goals/g1/progress', { current_value: 750, progress_percentage: 75 });
  });

  it('When currentValue exceeds targetValue / Then progress_percentage is capped at 100', async () => {
    mockApi.patch.mockResolvedValue({ id: 'g1', current_value: 1200, progress_percentage: 100 });
    await goalsApi.updateProgress('g1', 1200, 1000);
    expect(mockApi.patch).toHaveBeenCalledWith('/goals/g1/progress', { current_value: 1200, progress_percentage: 100 });
  });

  it('When targetValue is undefined / Then progress_percentage defaults to 0', async () => {
    mockApi.patch.mockResolvedValue({ id: 'g1', current_value: 50, progress_percentage: 0 });
    await goalsApi.updateProgress('g1', 50, undefined);
    expect(mockApi.patch).toHaveBeenCalledWith('/goals/g1/progress', { current_value: 50, progress_percentage: 0 });
  });

  it('When targetValue is 0 / Then progress_percentage defaults to 0', async () => {
    mockApi.patch.mockResolvedValue({ id: 'g1', current_value: 50, progress_percentage: 0 });
    await goalsApi.updateProgress('g1', 50, 0);
    expect(mockApi.patch).toHaveBeenCalledWith('/goals/g1/progress', { current_value: 50, progress_percentage: 0 });
  });
});

describe('Given goalsApi.complete', () => {
  it('When called with id / Then it calls POST /goals/:id/complete', async () => {
    mockApi.post.mockResolvedValue({ id: 'g1', status: 'completed', progress_percentage: 100 });
    await goalsApi.complete('g1');
    expect(mockApi.post).toHaveBeenCalledWith('/goals/g1/complete', {});
  });

  it('When complete resolves / Then the goal status is completed', async () => {
    mockApi.post.mockResolvedValue({ id: 'g1', status: 'completed' });
    const result = await goalsApi.complete('g1');
    expect(result.status).toBe('completed');
  });
});

describe('Given goalsApi.delete', () => {
  it('When called with id / Then it calls DELETE /goals/:id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Deleted' });
    await goalsApi.delete('g1');
    expect(mockApi.delete).toHaveBeenCalledWith('/goals/g1');
  });
});
