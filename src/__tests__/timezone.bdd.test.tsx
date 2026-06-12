/**
 * BDD specs: timezone-aware date rendering across People Connect MFE pages.
 *
 * All pages use usePeopleFormatters() → @so360/formatters stub aliased in
 * vitest.config.ts to src/test/__mocks__/formatters.ts.
 * With timezone='UTC' and locale='en-US':
 *   formatDate('2025-06-01T10:00:00Z')  → 'Jun 1, 2025'
 *   formatDate('2025-06-03T00:00:00Z')  → 'Jun 3, 2025'
 *   formatDate('2025-01-01T00:00:00Z')  → 'Jan 1, 2025'
 *   formatDate('2025-03-31T00:00:00Z')  → 'Mar 31, 2025'
 *   formatDateTime('2025-06-01T10:30:00Z') → 'Jun 1, 2025, 10:30 AM'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    submit: vi.fn(),
    getBalances: vi.fn(),
  },
  LeaveRequest: {},
  CreateLeaveRequestPayload: {},
  LeaveBalance: {},
}));

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn() },
  LeaveType: {},
}));

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: {
    getById: vi.fn(),
    getAll: vi.fn(),
    submitSelfReview: vi.fn(),
    submitManagerReview: vi.fn(),
    complete: vi.fn(),
  },
  PerformanceReview: {},
}));

vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
  },
  ReviewTemplate: {},
  ReviewTemplateSection: {},
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    getEmploymentHistory: vi.fn(),
    getRateHistory: vi.fn(),
    linkUser: vi.fn(),
    unlinkUser: vi.fn(),
    updateRate: vi.fn(),
  },
  allocationsApi: {
    getAll: vi.fn(),
  },
}));

vi.mock('../services/timesheetApi', () => ({
  timesheetApi: { getEntries: vi.fn() },
}));

vi.mock('../services/goalsService', () => ({
  goalsApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  Goal: {},
}));

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: {
    getAll: vi.fn(),
  },
  WorkLocation: {},
}));

vi.mock('../services/feedbackService', () => ({
  feedbackApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    acknowledge: vi.fn(),
  },
  Feedback: {},
  CreateFeedbackPayload: {},
}));

vi.mock('../services/apiClient', () => ({
  apiContext: { getUserId: () => 'u1' },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import LeaveRequestsPage from '../pages/LeaveRequestsPage';
import ReviewDetailPage from '../pages/ReviewDetailPage';
import PersonDetailPage from '../pages/PersonDetailPage';
import FeedbackPage from '../pages/FeedbackPage';

import { leaveRequestsApi } from '../services/leaveRequestsService';
import { leaveTypesApi } from '../services/leaveTypesService';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';
import { peopleApi, allocationsApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import { workLocationsApi } from '../services/workLocationsService';
import { feedbackApi } from '../services/feedbackService';

const leaveApi = leaveRequestsApi as any;
const leaveTypes = leaveTypesApi as any;
const reviewsApi = performanceReviewsApi as any;
const templatesApi = reviewTemplatesApi as any;
const people = peopleApi as any;
const allocs = allocationsApi as any;
const time = timesheetApi as any;
const locations = workLocationsApi as any;
const feedback = feedbackApi as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderPage = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const renderWithId = (element: React.ReactElement, path: string, id: string) =>
  render(
    <MemoryRouter initialEntries={[`${path}/${id}`]}>
      <Routes>
        <Route path={`${path}/:id`} element={element} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.resetAllMocks();
});

// ===========================================================================
// LeaveRequestsPage — timezone date rendering
// ===========================================================================

describe('LeaveRequestsPage — timezone date rendering', () => {
  describe('Given leave requests with UTC start_date and end_date', () => {
    beforeEach(() => {
      leaveApi.getAll.mockResolvedValue({
        data: [
          {
            id: 'lr1',
            person_id: 'p1',
            leave_type_id: 'lt1',
            start_date: '2025-06-01T00:00:00Z',
            end_date: '2025-06-03T00:00:00Z',
            is_half_day_start: false,
            is_half_day_end: false,
            total_days: 3,
            status: 'approved',
            submitted_at: '2025-05-28T08:00:00Z',
            person: { id: 'p1', full_name: 'Alice Smith', avatar_url: null },
            leave_type: { id: 'lt1', name: 'Annual Leave', code: 'AL', color: '#10b981' },
          },
        ],
      });
    });

    it('When the page renders / Then start_date shows Jun 1, 2025', async () => {
      renderPage(<LeaveRequestsPage />);
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      expect(screen.getByText('Jun 1, 2025')).toBeInTheDocument();
    });

    it('When the page renders / Then end_date shows Jun 3, 2025', async () => {
      renderPage(<LeaveRequestsPage />);
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      expect(screen.getByText('Jun 3, 2025')).toBeInTheDocument();
    });

    it('When the page renders / Then leave type name is shown', async () => {
      renderPage(<LeaveRequestsPage />);
      await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    });

    it('When the page renders / Then total days is shown', async () => {
      renderPage(<LeaveRequestsPage />);
      await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    });
  });

  describe('Given multiple requests with different UTC dates', () => {
    beforeEach(() => {
      leaveApi.getAll.mockResolvedValue({
        data: [
          {
            id: 'lr2',
            person_id: 'p2',
            leave_type_id: 'lt2',
            start_date: '2025-01-01T00:00:00Z',
            end_date: '2025-01-05T00:00:00Z',
            is_half_day_start: false,
            is_half_day_end: false,
            total_days: 5,
            status: 'pending',
            submitted_at: '2024-12-20T00:00:00Z',
            person: { id: 'p2', full_name: 'Bob Jones', avatar_url: null },
            leave_type: { id: 'lt2', name: 'Sick Leave', code: 'SL', color: '#f59e0b' },
          },
        ],
      });
    });

    it('When the page renders / Then start_date shows Jan 1, 2025', async () => {
      renderPage(<LeaveRequestsPage />);
      await waitFor(() => expect(screen.getByText('Bob Jones')).toBeInTheDocument());
      expect(screen.getByText('Jan 1, 2025')).toBeInTheDocument();
    });

    it('When the page renders / Then end_date shows Jan 5, 2025', async () => {
      renderPage(<LeaveRequestsPage />);
      await waitFor(() => expect(screen.getByText('Bob Jones')).toBeInTheDocument());
      expect(screen.getByText('Jan 5, 2025')).toBeInTheDocument();
    });
  });

  describe('Given no leave requests exist', () => {
    beforeEach(() => {
      leaveApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page renders / Then empty state is shown', async () => {
      renderPage(<LeaveRequestsPage />);
      await waitFor(() =>
        expect(screen.getByText(/No leave requests found/i)).toBeInTheDocument(),
      );
    });
  });
});

// ===========================================================================
// ReviewDetailPage — timezone date rendering
// ===========================================================================

describe('ReviewDetailPage — timezone date rendering', () => {
  const mockTemplate = {
    id: 'tmpl-1',
    name: 'Q1 2025 Review',
    description: 'Standard review',
    review_type: 'annual',
    rating_scale: 5,
    is_active: true,
    sections: [],
  };

  const mockReview = {
    id: 'rev-001',
    template_id: 'tmpl-1',
    person_id: 'p1',
    reviewer_id: 'r1',
    status: 'pending_self_review',
    review_period_start: '2025-01-01T00:00:00Z',
    review_period_end: '2025-03-31T23:59:59Z',
    self_review_deadline: '2025-04-15T23:59:59Z',
    manager_review_deadline: '2025-04-30T23:59:59Z',
    final_rating: null,
    self_review_data: null,
    manager_review_data: null,
    self_review_submitted_at: null,
    manager_review_submitted_at: null,
    person: { id: 'p1', full_name: 'Charlie Dev', avatar_url: null },
    reviewer: { id: 'r1', full_name: 'Dana Manager', avatar_url: null },
  };

  describe('Given a review with UTC review_period_start/end', () => {
    beforeEach(() => {
      reviewsApi.getById.mockResolvedValue(mockReview);
      templatesApi.getById.mockResolvedValue(mockTemplate);
    });

    it('When the page renders / Then review_period_start shows Jan 1, 2025 in the subtitle', async () => {
      renderWithId(<ReviewDetailPage />, '/reviews', 'rev-001');
      // The name appears as part of the title "Charlie Dev - Review"
      await waitFor(() => expect(screen.getByText(/Charlie Dev/)).toBeInTheDocument());
      expect(screen.getByText(/Jan 1, 2025/)).toBeInTheDocument();
    });

    it('When the page renders / Then review_period_end shows Mar 31, 2025 in the subtitle', async () => {
      renderWithId(<ReviewDetailPage />, '/reviews', 'rev-001');
      await waitFor(() => expect(screen.getByText(/Charlie Dev/)).toBeInTheDocument());
      expect(screen.getByText(/Mar 31, 2025/)).toBeInTheDocument();
    });

    it('When the page renders / Then self_review_deadline shows Apr 15, 2025', async () => {
      renderWithId(<ReviewDetailPage />, '/reviews', 'rev-001');
      await waitFor(() => expect(screen.getByText(/Charlie Dev/)).toBeInTheDocument());
      expect(screen.getByText('Apr 15, 2025')).toBeInTheDocument();
    });

    it('When the page renders / Then manager_review_deadline shows Apr 30, 2025', async () => {
      renderWithId(<ReviewDetailPage />, '/reviews', 'rev-001');
      await waitFor(() => expect(screen.getByText(/Charlie Dev/)).toBeInTheDocument());
      expect(screen.getByText('Apr 30, 2025')).toBeInTheDocument();
    });

    it('When the page renders / Then reviewer name is shown', async () => {
      renderWithId(<ReviewDetailPage />, '/reviews', 'rev-001');
      await waitFor(() => expect(screen.getByText('Dana Manager')).toBeInTheDocument());
    });
  });

  describe('Given getById rejects', () => {
    beforeEach(() => {
      reviewsApi.getById.mockRejectedValue(new Error('Review not found'));
      templatesApi.getById.mockResolvedValue(mockTemplate);
    });

    it('When fetch fails / Then the page still renders without crash', async () => {
      renderWithId(<ReviewDetailPage />, '/reviews', 'bad-id');
      // Wait for loading to complete; no crash
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), {
        timeout: 3000,
      });
    });
  });
});

// ===========================================================================
// PersonDetailPage — timezone date rendering (employment history tab)
// ===========================================================================

describe('PersonDetailPage — timezone date rendering', () => {
  const mockPerson = {
    id: 'person-001',
    full_name: 'Eve Contractor',
    email: 'eve@example.com',
    phone: '+1234567890',
    status: 'active',
    type: 'employee',
    employment_type: 'full_time',
    department_id: 'dept-1',
    department: null,
    job_title: 'Engineer',
    cost_rate: 50,
    cost_rate_unit: 'hour',
    available_hours_per_day: 8,
    avatar_url: null,
    work_location_id: null,
    work_location: null,
    start_date: null,
    user_id: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-01T08:00:00Z',
    roles: [],
    user_links: [],
  };

  const mockEmploymentEvent = {
    id: 'evt1',
    person_id: 'person-001',
    event_type: 'hire',
    effective_date: '2025-06-01T00:00:00Z',
    created_at: '2025-06-01T10:30:00Z',
    notes: 'Initial hire',
    new_job_title: 'Engineer',
    new_department_id: 'dept-1',
    new_department_name: 'Engineering',
  };

  describe('Given a person and employment history with UTC effective_date', () => {
    beforeEach(() => {
      people.getById.mockResolvedValue(mockPerson);
      allocs.getAll.mockResolvedValue({ data: [] });
      time.getEntries.mockResolvedValue({ data: [] });
      locations.getAll.mockResolvedValue({ data: [] });
      people.getEmploymentHistory.mockResolvedValue([mockEmploymentEvent]);
      people.getRateHistory.mockResolvedValue([]);
    });

    it('When the page loads / Then the person name is shown', async () => {
      renderWithId(<PersonDetailPage />, '/people', 'person-001');
      await waitFor(() => expect(screen.getByText('Eve Contractor')).toBeInTheDocument());
    });

    it('When Employment History tab is clicked / Then effective_date shows Jun 1, 2025', async () => {
      renderWithId(<PersonDetailPage />, '/people', 'person-001');
      await waitFor(() => expect(screen.getByText('Eve Contractor')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Employment History'));
      await waitFor(() => expect(people.getEmploymentHistory).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByText('Jun 1, 2025')).toBeInTheDocument());
    });

    it('When Employment History tab is clicked / Then created_at shows Jun 1, 2025, 10:30 AM', async () => {
      renderWithId(<PersonDetailPage />, '/people', 'person-001');
      await waitFor(() => expect(screen.getByText('Eve Contractor')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Employment History'));
      await waitFor(() => expect(people.getEmploymentHistory).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.getByText('Jun 1, 2025, 10:30 AM')).toBeInTheDocument(),
      );
    });

    it('When Employment History tab is clicked / Then event notes are shown', async () => {
      renderWithId(<PersonDetailPage />, '/people', 'person-001');
      await waitFor(() => expect(screen.getByText('Eve Contractor')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Employment History'));
      await waitFor(() => expect(screen.getByText('Initial hire')).toBeInTheDocument());
    });
  });

  describe('Given getById fails', () => {
    beforeEach(() => {
      people.getById.mockRejectedValue(new Error('Person not found'));
      allocs.getAll.mockResolvedValue({ data: [] });
      time.getEntries.mockResolvedValue({ data: [] });
      locations.getAll.mockResolvedValue({ data: [] });
    });

    it('When fetch fails / Then the load-error state is shown', async () => {
      renderWithId(<PersonDetailPage />, '/people', 'bad-id');
      await waitFor(() =>
        expect(screen.getByText(/Unable to load employee details/i)).toBeInTheDocument(),
      );
    });
  });
});

// ===========================================================================
// FeedbackPage — timezone date rendering
// ===========================================================================

describe('FeedbackPage — timezone date rendering', () => {
  describe('Given feedback entries with UTC created_at', () => {
    beforeEach(() => {
      feedback.getAll.mockResolvedValue({
        data: [
          {
            id: 'fb1',
            person_id: 'p1',
            provider_id: 'u1',
            feedback_type: 'positive',
            feedback_text: 'Excellent work on the Q2 project.',
            overall_rating: 5,
            is_anonymous: false,
            acknowledged_at: null,
            created_at: '2025-06-01T10:00:00Z',
            provider: { id: 'u1', full_name: 'Frank Giver', avatar_url: null },
            person: { id: 'p1', full_name: 'Grace Receiver', avatar_url: null },
          },
        ],
      });
    });

    it('When the page renders / Then created_at shows Jun 1, 2025', async () => {
      renderPage(<FeedbackPage />);
      await waitFor(() => expect(screen.getByText('Jun 1, 2025')).toBeInTheDocument());
    });

    it('When the page renders / Then feedback text is shown', async () => {
      renderPage(<FeedbackPage />);
      await waitFor(() =>
        expect(screen.getByText('Excellent work on the Q2 project.')).toBeInTheDocument(),
      );
    });

    it('When the page renders / Then feedback type badge is shown', async () => {
      renderPage(<FeedbackPage />);
      // positive renders as "positive" (replace('_',' ') no-ops for single-word)
      await waitFor(() => expect(screen.getByText('positive')).toBeInTheDocument());
    });
  });

  describe('Given feedback from December UTC date', () => {
    beforeEach(() => {
      feedback.getAll.mockResolvedValue({
        data: [
          {
            id: 'fb2',
            person_id: 'p2',
            provider_id: 'u2',
            feedback_type: 'constructive',
            feedback_text: 'Could improve documentation.',
            overall_rating: 3,
            is_anonymous: false,
            acknowledged_at: '2025-12-26T09:00:00Z',
            created_at: '2025-12-25T00:00:00Z',
            provider: { id: 'u2', full_name: 'Henry Giver', avatar_url: null },
            person: { id: 'p2', full_name: 'Iris Receiver', avatar_url: null },
          },
        ],
      });
    });

    it('When the page renders / Then created_at shows Dec 25, 2025', async () => {
      renderPage(<FeedbackPage />);
      await waitFor(() => expect(screen.getByText('Dec 25, 2025')).toBeInTheDocument());
    });

    it('When the page renders / Then acknowledged_at shows Dec 26, 2025', async () => {
      renderPage(<FeedbackPage />);
      await waitFor(() =>
        expect(screen.getByText(/Dec 26, 2025/)).toBeInTheDocument(),
      );
    });
  });

  describe('Given no feedback exists', () => {
    beforeEach(() => {
      feedback.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page renders / Then empty state is shown', async () => {
      renderPage(<FeedbackPage />);
      await waitFor(() =>
        expect(screen.getByText(/No feedback yet/i)).toBeInTheDocument(),
      );
    });
  });
});
