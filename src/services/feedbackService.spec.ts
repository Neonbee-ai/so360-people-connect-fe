import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { feedbackApi } from './feedbackService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given feedbackApi.getAll', () => {
  it('When called without params / Then it calls GET /feedback', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await feedbackApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/feedback', undefined);
  });

  it('When called with person_id filter / Then it passes the filter', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await feedbackApi.getAll({ person_id: 'p1' });
    expect(mockApi.get).toHaveBeenCalledWith('/feedback', { person_id: 'p1' });
  });

  it('When called with feedback_type filter / Then it passes the type', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await feedbackApi.getAll({ feedback_type: 'positive' });
    expect(mockApi.get).toHaveBeenCalledWith('/feedback', { feedback_type: 'positive' });
  });
});

describe('Given feedbackApi.getById', () => {
  it('When called with id / Then it calls GET /feedback/:id', async () => {
    mockApi.get.mockResolvedValue({ id: 'f1' });
    await feedbackApi.getById('f1');
    expect(mockApi.get).toHaveBeenCalledWith('/feedback/f1');
  });
});

describe('Given feedbackApi.create', () => {
  it('When called with payload / Then it calls POST /feedback', async () => {
    const payload = {
      person_id: 'p1',
      provider_id: 'p2',
      feedback_type: 'positive',
      feedback_text: 'Great work!',
    };
    mockApi.post.mockResolvedValue({ id: 'f1', ...payload });
    await feedbackApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/feedback', payload);
  });

  it('When API resolves / Then the created feedback is returned', async () => {
    const payload = { person_id: 'p1', provider_id: 'p2', feedback_type: 'general', feedback_text: 'Good' };
    mockApi.post.mockResolvedValue({ id: 'f-new', ...payload });
    const result = await feedbackApi.create(payload);
    expect(result.id).toBe('f-new');
  });
});

describe('Given feedbackApi.acknowledge', () => {
  it('When called with id / Then it calls PATCH /feedback/:id/acknowledge', async () => {
    mockApi.patch.mockResolvedValue({ id: 'f1', acknowledged_at: '2024-01-01' });
    await feedbackApi.acknowledge('f1');
    expect(mockApi.patch).toHaveBeenCalledWith('/feedback/f1/acknowledge', {});
  });

  it('When acknowledge resolves / Then acknowledged_at is populated', async () => {
    mockApi.patch.mockResolvedValue({ id: 'f1', acknowledged_at: '2024-01-01T00:00:00Z' });
    const result = await feedbackApi.acknowledge('f1');
    expect(result.acknowledged_at).toBeTruthy();
  });
});
