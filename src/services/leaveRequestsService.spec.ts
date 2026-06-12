import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { leaveRequestsApi } from './leaveRequestsService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given leaveRequestsApi.getAll', () => {
  it('When called without params / Then it calls GET /leave-requests', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await leaveRequestsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/leave-requests', undefined);
  });

  it('When filtered by person_id and status / Then params are passed', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await leaveRequestsApi.getAll({ person_id: 'p1', status: 'pending' });
    expect(mockApi.get).toHaveBeenCalledWith('/leave-requests', { person_id: 'p1', status: 'pending' });
  });
});

describe('Given leaveRequestsApi.create', () => {
  it('When called with payload / Then it calls POST /leave-requests', async () => {
    const payload = { person_id: 'p1', leave_type_id: 'lt1', start_date: '2024-06-01', end_date: '2024-06-05' };
    mockApi.post.mockResolvedValue({ id: 'lr1', ...payload, status: 'draft' });
    await leaveRequestsApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/leave-requests', payload);
  });
});

describe('Given leaveRequestsApi.submit', () => {
  it('When called with id / Then it calls POST /leave-requests/:id/submit', async () => {
    mockApi.post.mockResolvedValue({ id: 'lr1', status: 'pending' });
    await leaveRequestsApi.submit('lr1');
    expect(mockApi.post).toHaveBeenCalledWith('/leave-requests/lr1/submit', {});
  });
});

describe('Given leaveRequestsApi.approve', () => {
  it('When called with id / Then it calls POST /leave-requests/:id/approve', async () => {
    mockApi.post.mockResolvedValue({ id: 'lr1', status: 'approved' });
    await leaveRequestsApi.approve('lr1');
    expect(mockApi.post).toHaveBeenCalledWith('/leave-requests/lr1/approve', {});
  });
});

describe('Given leaveRequestsApi.reject', () => {
  it('When called with id and reason / Then it calls POST /leave-requests/:id/reject', async () => {
    mockApi.post.mockResolvedValue({ id: 'lr1', status: 'rejected', rejection_reason: 'No cover' });
    await leaveRequestsApi.reject('lr1', 'No cover');
    expect(mockApi.post).toHaveBeenCalledWith('/leave-requests/lr1/reject', { reason: 'No cover' });
  });
});

describe('Given leaveRequestsApi.getPendingApprovals', () => {
  it('When called / Then it calls GET /leave-requests/pending-approvals', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await leaveRequestsApi.getPendingApprovals();
    expect(mockApi.get).toHaveBeenCalledWith('/leave-requests/pending-approvals');
  });
});

describe('Given leaveRequestsApi.getBalances', () => {
  it('When called with personId / Then it calls GET /leave-balances?person_id=', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await leaveRequestsApi.getBalances('p1');
    expect(mockApi.get).toHaveBeenCalledWith('/leave-balances', { person_id: 'p1' });
  });
});
