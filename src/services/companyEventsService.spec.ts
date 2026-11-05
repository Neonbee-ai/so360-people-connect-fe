import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { companyEventsApi } from './companyEventsService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given companyEventsApi', () => {
  it('When getAll is called with filters / Then it GETs /company-events with them', async () => {
    mockApi.get.mockResolvedValue({ data: [], permissions: { can_create: false, can_manage: false } });
    await companyEventsApi.getAll({ when: 'upcoming' });
    expect(mockApi.get).toHaveBeenCalledWith('/company-events', { when: 'upcoming' });
  });

  it('When getAll is called without filters / Then it sends an empty filter object', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await companyEventsApi.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/company-events', {});
  });

  it('When get is called / Then it GETs the event by id', async () => {
    await companyEventsApi.get('e1');
    expect(mockApi.get).toHaveBeenCalledWith('/company-events/e1');
  });

  it('When create is called / Then it POSTs the payload', async () => {
    const payload = { title: 'Town hall', starts_at: 'a', ends_at: 'b' };
    await companyEventsApi.create(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/company-events', payload);
  });

  it('When update is called / Then it PATCHes the event', async () => {
    await companyEventsApi.update('e1', { title: 'New' });
    expect(mockApi.patch).toHaveBeenCalledWith('/company-events/e1', { title: 'New' });
  });

  it('When cancel is called / Then it PATCHes status cancelled', async () => {
    await companyEventsApi.cancel('e1');
    expect(mockApi.patch).toHaveBeenCalledWith('/company-events/e1', { status: 'cancelled' });
  });

  it('When delete is called / Then it DELETEs the event', async () => {
    await companyEventsApi.delete('e1');
    expect(mockApi.delete).toHaveBeenCalledWith('/company-events/e1');
  });

  it('When rsvp is called / Then it POSTs the response', async () => {
    await companyEventsApi.rsvp('e1', 'going');
    expect(mockApi.post).toHaveBeenCalledWith('/company-events/e1/rsvp', { response: 'going' });
  });
});
