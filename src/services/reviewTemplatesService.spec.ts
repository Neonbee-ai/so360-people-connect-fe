import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { reviewTemplatesApi } from './reviewTemplatesService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given reviewTemplatesApi.getAll', () => {
  it('When called without params / Then it calls GET /review-templates', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await reviewTemplatesApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/review-templates', undefined);
  });

  it('When called with review_type / Then it passes the filter', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await reviewTemplatesApi.getAll({ review_type: 'annual' });
    expect(mockApi.get).toHaveBeenCalledWith('/review-templates', { review_type: 'annual' });
  });
});

describe('Given reviewTemplatesApi.getById', () => {
  it('When called with id / Then it calls GET /review-templates/:id', async () => {
    mockApi.get.mockResolvedValue({ id: 'tpl1', name: 'Annual Review' });
    await reviewTemplatesApi.getById('tpl1');
    expect(mockApi.get).toHaveBeenCalledWith('/review-templates/tpl1');
  });
});

describe('Given reviewTemplatesApi.create', () => {
  it('When called with payload / Then it calls POST /review-templates', async () => {
    const payload = {
      name: 'Annual 2024',
      review_type: 'annual' as const,
      sections: [],
      requires_self_review: true,
      requires_manager_review: true,
    };
    mockApi.post.mockResolvedValue({ id: 'tpl-new', ...payload });
    await reviewTemplatesApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/review-templates', payload);
  });
});

describe('Given reviewTemplatesApi.update', () => {
  it('When called with id and data / Then it calls PATCH /review-templates/:id', async () => {
    mockApi.patch.mockResolvedValue({ id: 'tpl1', is_active: false });
    await reviewTemplatesApi.update('tpl1', { is_active: false });
    expect(mockApi.patch).toHaveBeenCalledWith('/review-templates/tpl1', { is_active: false });
  });
});

describe('Given reviewTemplatesApi.delete', () => {
  it('When called with id / Then it calls DELETE /review-templates/:id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Deleted' });
    await reviewTemplatesApi.delete('tpl1');
    expect(mockApi.delete).toHaveBeenCalledWith('/review-templates/tpl1');
  });
});

describe('Given reviewTemplatesApi.clone', () => {
  it('When called with id and new name / Then it calls POST /review-templates/:id/clone', async () => {
    mockApi.post.mockResolvedValue({ id: 'tpl-clone', name: 'Annual 2025 Clone' });
    await reviewTemplatesApi.clone('tpl1', 'Annual 2025 Clone');
    expect(mockApi.post).toHaveBeenCalledWith('/review-templates/tpl1/clone', { name: 'Annual 2025 Clone' });
  });

  it('When clone resolves / Then it returns the new template with a new id', async () => {
    mockApi.post.mockResolvedValue({ id: 'tpl-2', name: 'Copy of Annual' });
    const result = await reviewTemplatesApi.clone('tpl1', 'Copy of Annual');
    expect(result.id).toBe('tpl-2');
    expect(result.name).toBe('Copy of Annual');
  });
});
