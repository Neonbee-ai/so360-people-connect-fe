import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/apiClient', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getHeadersRaw: vi.fn().mockReturnValue({}),
  };
  return {
    api: mockApi,
    ApiClient: vi.fn(),
    apiContext: {
      getBaseUrl: () => '/people-api',
      getTenantId: () => 't1',
      getOrgId: () => 'o1',
      getUserId: () => 'u1',
      getAccessToken: () => 'tok',
      setTenantId: vi.fn(),
      setOrgId: vi.fn(),
      setUserId: vi.fn(),
      setUserName: vi.fn(),
      setAccessToken: vi.fn(),
      setUser: vi.fn(),
    },
  };
});

import { api } from '../services/apiClient';
import { feedbackApi } from '../services/feedbackService';
import { goalsApi } from '../services/goalsService';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { leaveTypesApi } from '../services/leaveTypesService';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';
import {
  peopleApi,
  allocationsApi,
  timeEntriesApi,
  utilizationApi,
  eventsApi,
} from '../services/peopleService';

const mockApi = api as any;

beforeEach(() => vi.resetAllMocks());

describe('feedbackApi', () => {
  describe('Given the feedback API', () => {
    it('When getAll is called / Then it calls api.get with /feedback', async () => {
      mockApi.get.mockResolvedValue({ data: [], meta: { total: 0 } });
      await feedbackApi.getAll({ feedback_type: 'positive' });
      expect(mockApi.get).toHaveBeenCalledWith('/feedback', { feedback_type: 'positive' });
    });

    it('When getById is called / Then it calls api.get with /feedback/:id', async () => {
      mockApi.get.mockResolvedValue({ id: 'f1' });
      await feedbackApi.getById('f1');
      expect(mockApi.get).toHaveBeenCalledWith('/feedback/f1');
    });

    it('When create is called / Then it calls api.post', async () => {
      mockApi.post.mockResolvedValue({ id: 'f2' });
      await feedbackApi.create({ person_id: 'p1', provider_id: 'u1', feedback_type: 'positive', feedback_text: 'Great' });
      expect(mockApi.post).toHaveBeenCalledWith('/feedback', expect.any(Object));
    });

    it('When acknowledge is called / Then it calls api.patch', async () => {
      mockApi.patch.mockResolvedValue({ id: 'f1' });
      await feedbackApi.acknowledge('f1');
      expect(mockApi.patch).toHaveBeenCalledWith('/feedback/f1/acknowledge', {});
    });
  });
});

describe('goalsApi', () => {
  describe('Given the goals API', () => {
    it('When getAll is called / Then it calls api.get with /goals', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await goalsApi.getAll({ status: 'in_progress' });
      expect(mockApi.get).toHaveBeenCalledWith('/goals', { status: 'in_progress' });
    });

    it('When getById is called / Then it returns the goal', async () => {
      mockApi.get.mockResolvedValue({ id: 'g1', title: 'Test' });
      const result = await goalsApi.getById('g1');
      expect(result.title).toBe('Test');
    });

    it('When create is called / Then it posts to /goals', async () => {
      mockApi.post.mockResolvedValue({ id: 'g2' });
      await goalsApi.create({ person_id: 'p1', title: 'Goal', target_date: '2025-12-31', goal_type: 'individual' });
      expect(mockApi.post).toHaveBeenCalledWith('/goals', expect.any(Object));
    });

    it('When update is called / Then it patches the goal', async () => {
      mockApi.patch.mockResolvedValue({ id: 'g1' });
      await goalsApi.update('g1', { title: 'Updated' });
      expect(mockApi.patch).toHaveBeenCalledWith('/goals/g1', { title: 'Updated' });
    });

    it('When delete is called / Then it deletes the goal', async () => {
      mockApi.delete.mockResolvedValue({ message: 'deleted' });
      await goalsApi.delete('g1');
      expect(mockApi.delete).toHaveBeenCalledWith('/goals/g1');
    });

    it('When updateProgress is called / Then it posts to /goals/:id/update-progress', async () => {
      mockApi.post.mockResolvedValue({ id: 'g1' });
      await goalsApi.updateProgress('g1', 75);
      expect(mockApi.post).toHaveBeenCalledWith('/goals/g1/update-progress', { current_value: 75 });
    });

    it('When complete is called / Then it posts to /goals/:id/complete', async () => {
      mockApi.post.mockResolvedValue({ id: 'g1' });
      await goalsApi.complete('g1');
      expect(mockApi.post).toHaveBeenCalledWith('/goals/g1/complete', {});
    });
  });
});

describe('leaveRequestsApi', () => {
  describe('Given the leave requests API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await leaveRequestsApi.getAll({ status: 'pending' });
      expect(mockApi.get).toHaveBeenCalledWith('/leave-requests', { status: 'pending' });
    });

    it('When getById is called / Then it returns the request', async () => {
      mockApi.get.mockResolvedValue({ id: 'lr1' });
      const r = await leaveRequestsApi.getById('lr1');
      expect(r.id).toBe('lr1');
    });

    it('When create is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'lr2' });
      await leaveRequestsApi.create({ person_id: 'p1', leave_type_id: 'lt1', start_date: '2025-01-01', end_date: '2025-01-02' });
      expect(mockApi.post).toHaveBeenCalled();
    });

    it('When update is called / Then it patches', async () => {
      mockApi.patch.mockResolvedValue({ id: 'lr1' });
      await leaveRequestsApi.update('lr1', { reason: 'updated' });
      expect(mockApi.patch).toHaveBeenCalledWith('/leave-requests/lr1', { reason: 'updated' });
    });

    it('When delete is called / Then it deletes', async () => {
      mockApi.delete.mockResolvedValue({ message: 'deleted' });
      await leaveRequestsApi.delete('lr1');
      expect(mockApi.delete).toHaveBeenCalledWith('/leave-requests/lr1');
    });

    it('When submit is called / Then it posts to submit endpoint', async () => {
      mockApi.post.mockResolvedValue({ id: 'lr1' });
      await leaveRequestsApi.submit('lr1');
      expect(mockApi.post).toHaveBeenCalledWith('/leave-requests/lr1/submit', {});
    });

    it('When approve is called / Then it posts to approve endpoint', async () => {
      mockApi.post.mockResolvedValue({ id: 'lr1' });
      await leaveRequestsApi.approve('lr1');
      expect(mockApi.post).toHaveBeenCalledWith('/leave-requests/lr1/approve', {});
    });

    it('When reject is called / Then it posts reason to reject endpoint', async () => {
      mockApi.post.mockResolvedValue({ id: 'lr1' });
      await leaveRequestsApi.reject('lr1', 'Not enough notice');
      expect(mockApi.post).toHaveBeenCalledWith('/leave-requests/lr1/reject', { reason: 'Not enough notice' });
    });

    it('When getPendingApprovals is called / Then it calls the pending endpoint', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await leaveRequestsApi.getPendingApprovals();
      expect(mockApi.get).toHaveBeenCalledWith('/leave-requests/pending-approvals');
    });

    it('When getBalances is called / Then it calls the balances endpoint', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await leaveRequestsApi.getBalances('p1');
      expect(mockApi.get).toHaveBeenCalledWith('/leave-balances', { person_id: 'p1' });
    });
  });
});

describe('leaveTypesApi', () => {
  describe('Given the leave types API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await leaveTypesApi.getAll({ is_active: true });
      expect(mockApi.get).toHaveBeenCalledWith('/leave-types', { is_active: true });
    });

    it('When getById is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ id: 'lt1' });
      await leaveTypesApi.getById('lt1');
      expect(mockApi.get).toHaveBeenCalledWith('/leave-types/lt1');
    });

    it('When create is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'lt2' });
      await leaveTypesApi.create({ code: 'SL', name: 'Sick Leave' });
      expect(mockApi.post).toHaveBeenCalled();
    });

    it('When update is called / Then it patches', async () => {
      mockApi.patch.mockResolvedValue({ id: 'lt1' });
      await leaveTypesApi.update('lt1', { name: 'Updated' });
      expect(mockApi.patch).toHaveBeenCalled();
    });

    it('When delete is called / Then it deletes', async () => {
      mockApi.delete.mockResolvedValue({ message: 'ok' });
      await leaveTypesApi.delete('lt1');
      expect(mockApi.delete).toHaveBeenCalledWith('/leave-types/lt1');
    });
  });
});

describe('performanceReviewsApi', () => {
  describe('Given the performance reviews API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await performanceReviewsApi.getAll({ status: 'completed' });
      expect(mockApi.get).toHaveBeenCalledWith('/performance-reviews', { status: 'completed' });
    });

    it('When getById is called / Then it returns the review', async () => {
      mockApi.get.mockResolvedValue({ id: 'pr1' });
      await performanceReviewsApi.getById('pr1');
      expect(mockApi.get).toHaveBeenCalledWith('/performance-reviews/pr1');
    });

    it('When create is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'pr2' });
      await performanceReviewsApi.create({
        person_id: 'p1', template_id: 't1', reviewer_id: 'r1',
        review_period_start: '2025-01-01', review_period_end: '2025-12-31',
      });
      expect(mockApi.post).toHaveBeenCalled();
    });

    it('When update is called / Then it patches', async () => {
      mockApi.patch.mockResolvedValue({ id: 'pr1' });
      await performanceReviewsApi.update('pr1', { status: 'completed' });
      expect(mockApi.patch).toHaveBeenCalled();
    });

    it('When delete is called / Then it deletes', async () => {
      mockApi.delete.mockResolvedValue({ message: 'ok' });
      await performanceReviewsApi.delete('pr1');
      expect(mockApi.delete).toHaveBeenCalledWith('/performance-reviews/pr1');
    });

    it('When getMyReviews is called / Then it calls the my-reviews endpoint', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await performanceReviewsApi.getMyReviews();
      expect(mockApi.get).toHaveBeenCalledWith('/performance-reviews/my-reviews');
    });

    it('When submitSelfReview is called / Then it posts self review data', async () => {
      mockApi.post.mockResolvedValue({ id: 'pr1' });
      await performanceReviewsApi.submitSelfReview('pr1', { rating: 4 });
      expect(mockApi.post).toHaveBeenCalledWith('/performance-reviews/pr1/submit-self-review', { self_review_data: { rating: 4 } });
    });

    it('When submitManagerReview is called / Then it posts manager review data and rating', async () => {
      mockApi.post.mockResolvedValue({ id: 'pr1' });
      await performanceReviewsApi.submitManagerReview('pr1', { feedback: 'Good' }, 4.5);
      expect(mockApi.post).toHaveBeenCalledWith('/performance-reviews/pr1/submit-manager-review', {
        manager_review_data: { feedback: 'Good' },
        overall_rating: 4.5,
      });
    });

    it('When complete is called / Then it posts to complete endpoint', async () => {
      mockApi.post.mockResolvedValue({ id: 'pr1' });
      await performanceReviewsApi.complete('pr1');
      expect(mockApi.post).toHaveBeenCalledWith('/performance-reviews/pr1/complete', {});
    });
  });
});

describe('reviewTemplatesApi', () => {
  describe('Given the review templates API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await reviewTemplatesApi.getAll({ is_active: true });
      expect(mockApi.get).toHaveBeenCalledWith('/review-templates', { is_active: true });
    });

    it('When getById is called / Then it returns the template', async () => {
      mockApi.get.mockResolvedValue({ id: 'rt1' });
      await reviewTemplatesApi.getById('rt1');
      expect(mockApi.get).toHaveBeenCalledWith('/review-templates/rt1');
    });

    it('When create is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'rt2' });
      await reviewTemplatesApi.create({ name: 'Annual', review_type: 'annual', sections: [] });
      expect(mockApi.post).toHaveBeenCalled();
    });

    it('When update is called / Then it patches', async () => {
      mockApi.patch.mockResolvedValue({ id: 'rt1' });
      await reviewTemplatesApi.update('rt1', { name: 'Updated' });
      expect(mockApi.patch).toHaveBeenCalled();
    });

    it('When delete is called / Then it deletes', async () => {
      mockApi.delete.mockResolvedValue({ message: 'ok' });
      await reviewTemplatesApi.delete('rt1');
      expect(mockApi.delete).toHaveBeenCalledWith('/review-templates/rt1');
    });

    it('When clone is called / Then it posts to clone endpoint', async () => {
      mockApi.post.mockResolvedValue({ id: 'rt3' });
      await reviewTemplatesApi.clone('rt1', 'Copy of Annual');
      expect(mockApi.post).toHaveBeenCalledWith('/review-templates/rt1/clone', { name: 'Copy of Annual' });
    });
  });
});

describe('peopleApi', () => {
  describe('Given the people API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [], meta: { total: 0 } });
      await peopleApi.getAll({ status: 'active', search: 'John' });
      expect(mockApi.get).toHaveBeenCalledWith('/people', expect.objectContaining({ status: 'active', search: 'John' }));
    });

    it('When getById is called / Then it returns the person', async () => {
      mockApi.get.mockResolvedValue({ id: 'p1', full_name: 'Test' });
      const r = await peopleApi.getById('p1');
      expect(r.full_name).toBe('Test');
    });

    it('When create is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'p2' });
      await peopleApi.create({ full_name: 'New Person', type: 'employee' } as any);
      expect(mockApi.post).toHaveBeenCalled();
    });

    it('When update is called / Then it patches', async () => {
      mockApi.patch.mockResolvedValue({ id: 'p1' });
      await peopleApi.update('p1', { full_name: 'Updated' } as any);
      expect(mockApi.patch).toHaveBeenCalledWith('/people/p1', expect.any(Object));
    });

    it('When delete is called / Then it deletes', async () => {
      mockApi.delete.mockResolvedValue({ message: 'ok' });
      await peopleApi.delete('p1');
      expect(mockApi.delete).toHaveBeenCalledWith('/people/p1');
    });

    it('When addRole is called / Then it posts to roles endpoint', async () => {
      mockApi.post.mockResolvedValue({ id: 'r1' });
      await peopleApi.addRole('p1', { role_name: 'Dev', skill_category: 'Eng', proficiency: 'expert', is_primary: true });
      expect(mockApi.post).toHaveBeenCalledWith('/people/p1/roles', expect.any(Object));
    });

    it('When removeRole is called / Then it deletes the role', async () => {
      mockApi.delete.mockResolvedValue({ message: 'ok' });
      await peopleApi.removeRole('p1', 'r1');
      expect(mockApi.delete).toHaveBeenCalledWith('/people/p1/roles/r1');
    });

    it('When getEmploymentHistory is called / Then it calls the endpoint', async () => {
      mockApi.get.mockResolvedValue([]);
      await peopleApi.getEmploymentHistory('p1');
      expect(mockApi.get).toHaveBeenCalledWith('/people/p1/employment-history');
    });

    it('When getRateHistory is called / Then it calls the endpoint', async () => {
      mockApi.get.mockResolvedValue([]);
      await peopleApi.getRateHistory('p1');
      expect(mockApi.get).toHaveBeenCalledWith('/people/p1/rate-history');
    });

    it('When linkUser is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'p1' });
      await peopleApi.linkUser('p1', 'u1');
      expect(mockApi.post).toHaveBeenCalledWith('/people/p1/link-user', { user_id: 'u1' });
    });

    it('When inviteUser is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'p1' });
      await peopleApi.inviteUser('p1', 'test@test.com', 'member');
      expect(mockApi.post).toHaveBeenCalledWith('/people/p1/invite-user', { email: 'test@test.com', role: 'member' });
    });
  });
});

describe('peopleApi fetch-based methods', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('Given the export method', () => {
    it('When export succeeds / Then it returns a blob', async () => {
      const blob = new Blob(['csv']);
      (fetch as any).mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
      const result = await peopleApi.export('csv');
      expect(result).toBe(blob);
    });

    it('When export succeeds with filters / Then it includes filters in URL', async () => {
      const blob = new Blob(['csv']);
      (fetch as any).mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
      await peopleApi.export('excel', { status: 'active', type: 'employee' });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('format=excel'), expect.any(Object));
    });

    it('When export fails / Then it throws', async () => {
      (fetch as any).mockResolvedValue({ ok: false, status: 500 });
      await expect(peopleApi.export('csv')).rejects.toThrow('Failed to export people');
    });
  });

  describe('Given the import method', () => {
    it('When import succeeds / Then it returns the result', async () => {
      (fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: 5, errors: [] }) });
      const result = await peopleApi.import(new File(['test'], 'test.csv'));
      expect(result.success).toBe(5);
    });

    it('When import fails with JSON error / Then it throws with message', async () => {
      (fetch as any).mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('{"message":"Bad file"}') });
      await expect(peopleApi.import(new File(['test'], 'test.csv'))).rejects.toThrow('Bad file');
    });

    it('When import fails with non-JSON error / Then it throws with status', async () => {
      (fetch as any).mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('server error') });
      await expect(peopleApi.import(new File(['test'], 'test.csv'))).rejects.toThrow('Import failed: 500');
    });
  });

  describe('Given the getImportTemplate method', () => {
    it('When template download succeeds / Then it returns a blob', async () => {
      const blob = new Blob(['template']);
      (fetch as any).mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
      const result = await peopleApi.getImportTemplate();
      expect(result).toBe(blob);
    });

    it('When template download fails / Then it throws', async () => {
      (fetch as any).mockResolvedValue({ ok: false, status: 404 });
      await expect(peopleApi.getImportTemplate()).rejects.toThrow('Failed to download import template');
    });
  });

  describe('Given the validateImport method', () => {
    it('When validation succeeds / Then it returns the result', async () => {
      (fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({ valid: true, errors: [] }) });
      const result = await peopleApi.validateImport(new File(['test'], 'test.csv'));
      expect(result.valid).toBe(true);
    });

    it('When validation fails with JSON error / Then it throws with message', async () => {
      (fetch as any).mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('{"message":"Invalid format"}') });
      await expect(peopleApi.validateImport(new File(['test'], 'test.csv'))).rejects.toThrow('Invalid format');
    });

    it('When validation fails with non-JSON error / Then it throws with status', async () => {
      (fetch as any).mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('error') });
      await expect(peopleApi.validateImport(new File(['test'], 'test.csv'))).rejects.toThrow('Validation failed: 500');
    });
  });
});

describe('allocationsApi', () => {
  describe('Given the allocations API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await allocationsApi.getAll({ person_id: 'p1' });
      expect(mockApi.get).toHaveBeenCalledWith('/allocations', { person_id: 'p1' });
    });

    it('When getById is called / Then it returns the allocation', async () => {
      mockApi.get.mockResolvedValue({ id: 'a1' });
      await allocationsApi.getById('a1');
      expect(mockApi.get).toHaveBeenCalledWith('/allocations/a1');
    });

    it('When create is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'a2' });
      await allocationsApi.create({} as any);
      expect(mockApi.post).toHaveBeenCalled();
    });

    it('When update is called / Then it patches', async () => {
      mockApi.patch.mockResolvedValue({ id: 'a1' });
      await allocationsApi.update('a1', {} as any);
      expect(mockApi.patch).toHaveBeenCalled();
    });

    it('When cancel is called / Then it deletes', async () => {
      mockApi.delete.mockResolvedValue({ message: 'ok' });
      await allocationsApi.cancel('a1');
      expect(mockApi.delete).toHaveBeenCalledWith('/allocations/a1');
    });
  });
});

describe('timeEntriesApi', () => {
  describe('Given the time entries API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await timeEntriesApi.getAll({ status: 'draft' });
      expect(mockApi.get).toHaveBeenCalledWith('/time-entries', { status: 'draft' });
    });

    it('When create is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'te1' });
      await timeEntriesApi.create({} as any);
      expect(mockApi.post).toHaveBeenCalled();
    });

    it('When update is called / Then it patches', async () => {
      mockApi.patch.mockResolvedValue({ id: 'te1' });
      await timeEntriesApi.update('te1', {} as any);
      expect(mockApi.patch).toHaveBeenCalled();
    });

    it('When delete is called / Then it deletes', async () => {
      mockApi.delete.mockResolvedValue({ message: 'ok' });
      await timeEntriesApi.delete('te1');
      expect(mockApi.delete).toHaveBeenCalledWith('/time-entries/te1');
    });

    it('When submit is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'te1' });
      await timeEntriesApi.submit('te1');
      expect(mockApi.post).toHaveBeenCalledWith('/time-entries/te1/submit', {});
    });

    it('When approve is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'te1' });
      await timeEntriesApi.approve('te1');
      expect(mockApi.post).toHaveBeenCalledWith('/time-entries/te1/approve', {});
    });

    it('When reject is called / Then it posts with reason', async () => {
      mockApi.post.mockResolvedValue({ id: 'te1' });
      await timeEntriesApi.reject('te1', 'Bad entry');
      expect(mockApi.post).toHaveBeenCalledWith('/time-entries/te1/reject', { reason: 'Bad entry' });
    });
  });
});

describe('utilizationApi', () => {
  describe('Given the utilization API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [], period: { start: '', end: '' } });
      await utilizationApi.getAll({ period_start: '2025-01-01' });
      expect(mockApi.get).toHaveBeenCalledWith('/utilization', { period_start: '2025-01-01' });
    });

    it('When getSummary is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ total_people: 10 });
      await utilizationApi.getSummary();
      expect(mockApi.get).toHaveBeenCalledWith('/utilization/summary');
    });
  });
});

import { departmentsApi } from '../services/departmentsService';

describe('departmentsApi', () => {
  describe('Given the departments API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await departmentsApi.getAll({ is_active: true });
      expect(mockApi.get).toHaveBeenCalledWith('/departments', { is_active: true });
    });

    it('When getTree is called / Then it calls api.get with /departments/tree', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await departmentsApi.getTree();
      expect(mockApi.get).toHaveBeenCalledWith('/departments/tree');
    });

    it('When getById is called / Then it returns the department', async () => {
      mockApi.get.mockResolvedValue({ id: 'd1', name: 'Eng' });
      const r = await departmentsApi.getById('d1');
      expect(r.name).toBe('Eng');
    });

    it('When create is called / Then it posts', async () => {
      mockApi.post.mockResolvedValue({ id: 'd2' });
      await departmentsApi.create({ code: 'ENG', name: 'Engineering' });
      expect(mockApi.post).toHaveBeenCalledWith('/departments', expect.any(Object));
    });

    it('When update is called / Then it patches', async () => {
      mockApi.patch.mockResolvedValue({ id: 'd1' });
      await departmentsApi.update('d1', { name: 'Updated' });
      expect(mockApi.patch).toHaveBeenCalledWith('/departments/d1', { name: 'Updated' });
    });

    it('When delete is called / Then it deletes', async () => {
      mockApi.delete.mockResolvedValue({ message: 'ok' });
      await departmentsApi.delete('d1');
      expect(mockApi.delete).toHaveBeenCalledWith('/departments/d1');
    });
  });
});

describe('eventsApi', () => {
  describe('Given the events API', () => {
    it('When getAll is called / Then it calls api.get', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      await eventsApi.getAll({ event_type: 'person_created' });
      expect(mockApi.get).toHaveBeenCalledWith('/events', { event_type: 'person_created' });
    });
  });
});
