import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { onboardingApi, myOnboardingApi } from './onboardingService';
import { api } from './apiClient';

const mockApi = api as any;

beforeEach(() => {
  vi.resetAllMocks();
});

// =============================================================================
// Templates
// =============================================================================

describe('Given onboardingApi templates', () => {
  it('When listTemplates is called / Then it GETs /onboarding/templates', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await onboardingApi.listTemplates();
    expect(mockApi.get).toHaveBeenCalledWith('/onboarding/templates');
  });

  it('When getTemplate is called / Then it GETs the template by id', async () => {
    mockApi.get.mockResolvedValue({ id: 't1', items: [] });
    await onboardingApi.getTemplate('t1');
    expect(mockApi.get).toHaveBeenCalledWith('/onboarding/templates/t1');
  });

  it('When createTemplate is called with items / Then the full payload is POSTed', async () => {
    const payload = {
      name: 'Engineering New Hire',
      is_default: true,
      items: [
        { title: 'Sign contract', item_type: 'e_sign' as const, assignee_role: 'employee' as const, sort_order: 0, sign_document_ref: 'contract-v2' },
        { title: 'Meet your manager', item_type: 'meeting' as const, assignee_role: 'manager' as const, sort_order: 1, due_days_offset: 3 },
      ],
    };
    mockApi.post.mockResolvedValue({ id: 't1', ...payload });
    await onboardingApi.createTemplate(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/onboarding/templates', payload);
  });

  it('When updateTemplate is called with items / Then PATCH carries the replace-all list', async () => {
    const payload = { items: [{ title: 'Only step', item_type: 'task' as const, assignee_role: 'hr' as const, sort_order: 0 }] };
    mockApi.patch.mockResolvedValue({ id: 't1', items: payload.items });
    await onboardingApi.updateTemplate('t1', payload);
    expect(mockApi.patch).toHaveBeenCalledWith('/onboarding/templates/t1', payload);
  });

  it('When deleteTemplate is called / Then it DELETEs and surfaces the soft-delete outcome', async () => {
    mockApi.delete.mockResolvedValue({ deleted: false, deactivated: true });
    const result = await onboardingApi.deleteTemplate('t1');
    expect(mockApi.delete).toHaveBeenCalledWith('/onboarding/templates/t1');
    expect(result.deactivated).toBe(true);
  });
});

// =============================================================================
// Instances
// =============================================================================

describe('Given onboardingApi instances', () => {
  it('When startOnboarding is called without a template / Then only person_id is POSTed (server default applies)', async () => {
    mockApi.post.mockResolvedValue({ id: 'i1', items: [] });
    await onboardingApi.startOnboarding({ person_id: 'p1' });
    expect(mockApi.post).toHaveBeenCalledWith('/onboarding/instances', { person_id: 'p1' });
  });

  it('When listInstances is called with filters / Then person_id and status are forwarded as query params', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    await onboardingApi.listInstances({ person_id: 'p1', status: 'in_progress' });
    expect(mockApi.get).toHaveBeenCalledWith('/onboarding/instances', { person_id: 'p1', status: 'in_progress' });
  });

  it('When getInstance is called / Then it GETs the instance with items', async () => {
    mockApi.get.mockResolvedValue({ id: 'i1', items: [] });
    await onboardingApi.getInstance('i1');
    expect(mockApi.get).toHaveBeenCalledWith('/onboarding/instances/i1');
  });

  it('When cancelInstance is called / Then it POSTs the cancel action', async () => {
    mockApi.post.mockResolvedValue({ id: 'i1', status: 'cancelled' });
    await onboardingApi.cancelInstance('i1');
    expect(mockApi.post).toHaveBeenCalledWith('/onboarding/instances/i1/cancel', {});
  });
});

// =============================================================================
// Item actions
// =============================================================================

describe('Given onboardingApi item actions', () => {
  it('When completeItem is called without a note / Then the body is empty', async () => {
    mockApi.post.mockResolvedValue({ id: 'it1', status: 'done', instance_completed: false });
    await onboardingApi.completeItem('it1');
    expect(mockApi.post).toHaveBeenCalledWith('/onboarding/items/it1/complete', {});
  });

  it('When completeItem is called with a note / Then the note is forwarded', async () => {
    mockApi.post.mockResolvedValue({ id: 'it1', status: 'done', instance_completed: true });
    await onboardingApi.completeItem('it1', 'done in orientation');
    expect(mockApi.post).toHaveBeenCalledWith('/onboarding/items/it1/complete', { note: 'done in orientation' });
  });

  it('When waiveItem is called / Then the required note is always in the body', async () => {
    mockApi.post.mockResolvedValue({ id: 'it1', status: 'waived', instance_completed: false });
    await onboardingApi.waiveItem('it1', 'already provided at interview');
    expect(mockApi.post).toHaveBeenCalledWith('/onboarding/items/it1/waive', { note: 'already provided at interview' });
  });
});

// =============================================================================
// Self-service — /me/onboarding
// =============================================================================

describe('Given myOnboardingApi (self-service)', () => {
  it('When get is called / Then it GETs /me/onboarding with no person_id (server resolves the person)', async () => {
    mockApi.get.mockResolvedValue({ instance: null, items: [] });
    const result = await myOnboardingApi.get();
    expect(mockApi.get).toHaveBeenCalledWith('/me/onboarding');
    expect(result.instance).toBeNull();
  });

  it('When completeItem is called / Then it POSTs to the /me surface, not the admin route', async () => {
    mockApi.post.mockResolvedValue({ id: 'it1', status: 'done', instance_completed: false });
    await myOnboardingApi.completeItem('it1');
    expect(mockApi.post).toHaveBeenCalledWith('/me/onboarding/items/it1/complete', {});
  });
});

// =============================================================================
// Document upload (B4)
// =============================================================================

describe('Given document_upload completion (B4)', () => {
  it('When the admin uploadItemDocument is called / Then the file reference is POSTed to the admin route', async () => {
    mockApi.post.mockResolvedValue({ id: 'i1', status: 'done', instance_completed: false });
    await onboardingApi.uploadItemDocument('i1', {
      file_name: 'passport.pdf',
      file_url: 'https://cdn.example/p.pdf',
    });
    expect(mockApi.post).toHaveBeenCalledWith('/onboarding/items/i1/upload-document', {
      file_name: 'passport.pdf',
      file_url: 'https://cdn.example/p.pdf',
    });
  });

  it('When my uploadItemDocument is called / Then it POSTs to the /me surface, not the admin route', async () => {
    mockApi.post.mockResolvedValue({ id: 'i1', status: 'done', instance_completed: true });
    await myOnboardingApi.uploadItemDocument('i1', { file_name: 'passport.pdf' });
    expect(mockApi.post).toHaveBeenCalledWith('/me/onboarding/items/i1/upload-document', {
      file_name: 'passport.pdf',
    });
  });
});
