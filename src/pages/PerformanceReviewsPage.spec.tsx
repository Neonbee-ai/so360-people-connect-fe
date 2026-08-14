import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: {
    getAll: vi.fn(),
    getEligibleReviewers: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  PerformanceReview: {},
  CreatePerformanceReviewPayload: {},
}));

vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: { getAll: vi.fn() },
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

import PerformanceReviewsPage from './PerformanceReviewsPage';
import { performanceReviewsApi } from '../services/performanceReviewsService';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';
import { peopleApi } from '../services/peopleService';

const mockReviewsApi = performanceReviewsApi as any;
const mockTemplatesApi = reviewTemplatesApi as any;
const mockPeopleApi = peopleApi as any;

const renderPage = () => render(<MemoryRouter><PerformanceReviewsPage /></MemoryRouter>);

const mockReview = {
  id: 'rv1',
  person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' },
  template: { id: 'tpl1', name: 'Annual 2024', review_type: 'annual' },
  reviewer: { id: 'p2', full_name: 'Manager Bob' },
  review_period_start: '2024-01-01',
  review_period_end: '2024-12-31',
  status: 'draft',
  created_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockTemplatesApi.getAll.mockResolvedValue({ data: [] });
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
  mockReviewsApi.getEligibleReviewers.mockResolvedValue({ data: [], direct_manager_id: null });
});

describe('Given PerformanceReviewsPage loads with reviews', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [mockReview], total: 1 });
  });

  it('When page loads / Then "Performance Reviews" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Performance Reviews')).toBeInTheDocument());
  });

  it('When reviews are fetched / Then person name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('When reviews are fetched / Then template name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual 2024')).toBeInTheDocument());
  });
});

describe('Given PerformanceReviewsPage with no reviews', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no reviews exist / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No performance reviews/i)).toBeInTheDocument());
  });
});

describe('Given PerformanceReviewsPage API failure', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockImplementation(async () => { throw new Error('Server error'); });
  });

  it('When API fails / Then page renders without crashing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Performance Reviews')).toBeInTheDocument());
  });
});

describe('Given PerformanceReviewsPage status filter', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [mockReview], total: 1 });
  });

  it('When status filter changes / Then API is called with new status', async () => {
    renderPage();
    await waitFor(() => expect(mockReviewsApi.getAll).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'completed' } });
    await waitFor(() =>
      expect(mockReviewsApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }))
    );
  });
});

// Root-cause fix for "Review Template dropdown is empty":
// The Create Review modal called reviewTemplatesApi.getAll({ is_active: true }) but the
// backend only recognises ?status=active. The fix sends { status: 'active' } instead.

describe('Given PerformanceReviewsPage — Create Review modal template loading', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When the Create Review button is clicked / Then reviewTemplatesApi.getAll is called with { status: "active" }', async () => {
    mockTemplatesApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    // Wait for empty state with Create Review action button
    await waitFor(() => screen.getByText('Create Review'));
    fireEvent.click(screen.getAllByText('Create Review')[0]);
    await waitFor(() =>
      expect(mockTemplatesApi.getAll).toHaveBeenCalledWith({ status: 'active' })
    );
  });

  it('When the Create Review button is clicked / Then reviewTemplatesApi.getAll is NOT called with { is_active: true }', async () => {
    mockTemplatesApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => screen.getByText('Create Review'));
    fireEvent.click(screen.getAllByText('Create Review')[0]);
    await waitFor(() => expect(mockTemplatesApi.getAll).toHaveBeenCalled());
    expect(mockTemplatesApi.getAll).not.toHaveBeenCalledWith({ is_active: true });
  });

  it('When templates are returned / Then template names appear in the dropdown', async () => {
    mockTemplatesApi.getAll.mockResolvedValue({
      data: [
        { id: 'tpl1', name: 'Annual Review 2025', review_type: 'annual', is_active: true },
        { id: 'tpl2', name: 'Probation Review',   review_type: 'probation', is_active: true },
      ],
    });
    renderPage();
    await waitFor(() => screen.getByText('Create Review'));
    fireEvent.click(screen.getAllByText('Create Review')[0]);
    await waitFor(() => expect(screen.getByText('Annual Review 2025 (annual)')).toBeInTheDocument());
    expect(screen.getByText('Probation Review (probation)')).toBeInTheDocument();
  });

  it('When templates API returns empty / Then the empty-state prompt and seed button are shown', async () => {
    mockTemplatesApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => screen.getByText('Create Review'));
    fireEvent.click(screen.getAllByText('Create Review')[0]);
    await waitFor(() => expect(mockTemplatesApi.getAll).toHaveBeenCalled());
    expect(screen.getByText('No review templates found.')).toBeInTheDocument();
    expect(screen.getByText('Create default templates')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Annual|Quarterly|Probation/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Select template')).not.toBeInTheDocument();
  });

  it('When templates API rejects / Then the page does not crash', async () => {
    mockTemplatesApi.getAll.mockImplementation(async () => { throw new Error('Network error'); });
    renderPage();
    await waitFor(() => screen.getByText('Create Review'));
    fireEvent.click(screen.getAllByText('Create Review')[0]);
    await waitFor(() => expect(mockTemplatesApi.getAll).toHaveBeenCalled());
    expect(screen.getByText('Performance Reviews')).toBeInTheDocument();
  });
});

/*
 * Regression: opening a review (row click and the "View" action button)
 * previously called navigate('/reviews/<id>'), which — because the
 * people-connect MFE is mounted under the shell at '/people/*' — escaped the
 * module and hit the shell's "Page Not Found". The correct target is
 * '/people/reviews/<id>'.
 */
describe('Given a review row in the Performance Reviews table', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [mockReview], total: 1 });
  });

  it('When the "View" action is clicked / Then it navigates to the shell-prefixed review route', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('View')).toBeInTheDocument());
    fireEvent.click(screen.getByText('View'));
    expect(mockNavigate).toHaveBeenCalledWith('/people/reviews/rv1');
  });

  it('When the review row is clicked / Then it navigates to the shell-prefixed review route', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Alice'));
    expect(mockNavigate).toHaveBeenCalledWith('/people/reviews/rv1');
  });

  it('When a review is opened / Then it does NOT navigate to the bare /reviews/<id> path (regression guard)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('View')).toBeInTheDocument());
    fireEvent.click(screen.getByText('View'));
    expect(mockNavigate).not.toHaveBeenCalledWith('/reviews/rv1');
  });
});

/*
 * Reviewer restriction + review-period validation in the Create Review modal.
 *
 * The reviewer field is labelled "Reviewer (Manager)" but used to search the
 * same all-people list as the person field, so any employee could be assigned.
 * Eligibility now comes from the API (department heads), and the review period
 * can no longer run backwards.
 */
const ALICE = { id: 'p1', full_name: 'Alice', job_title: 'Engineer' };
const ASWIN = { id: 'p9', full_name: 'Aswin Shaji', job_title: 'Developer' };
const BOB_MANAGER = { id: 'p2', full_name: 'Manager Bob', job_title: 'Head of Engineering', heads_departments: ['Engineering'], is_direct_manager: true };
const ZOE_MANAGER = { id: 'p3', full_name: 'Zoe Head', job_title: 'Head of Design', heads_departments: ['Design'], is_direct_manager: false };

const openCreateModal = async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByText('Create Review').length).toBeGreaterThan(0));
  fireEvent.click(screen.getAllByText('Create Review')[0]);
  await waitFor(() => expect(screen.getByText('Person Being Reviewed *')).toBeInTheDocument());
};

const selectPerson = async (name: string) => {
  const personField = screen.getByTestId('person-picker').querySelector('input') as HTMLInputElement;
  fireEvent.focus(personField);
  await waitFor(() => expect(screen.getByText(new RegExp(name))).toBeInTheDocument());
  fireEvent.click(screen.getByText(new RegExp(name)));
};

describe('Given the Create Performance Review modal', () => {
  beforeEach(() => {
    mockReviewsApi.getAll.mockResolvedValue({ data: [], total: 0 });
    mockTemplatesApi.getAll.mockResolvedValue({ data: [{ id: 'tpl1', name: 'Annual', review_type: 'annual' }] });
    mockPeopleApi.getAll.mockResolvedValue({ data: [ALICE, ASWIN] });
    mockReviewsApi.getEligibleReviewers.mockResolvedValue({ data: [BOB_MANAGER, ZOE_MANAGER], direct_manager_id: BOB_MANAGER.id });
  });

  describe('Given the person field has not been touched', () => {
    it('When it receives focus / Then the full people list appears without typing', async () => {
      await openCreateModal();
      const personField = screen.getByTestId('person-picker').querySelector('input') as HTMLInputElement;

      expect(screen.queryByText(/Aswin Shaji/)).not.toBeInTheDocument();
      fireEvent.focus(personField);

      await waitFor(() => expect(screen.getByText(/Alice/)).toBeInTheDocument());
      expect(screen.getByText(/Aswin Shaji/)).toBeInTheDocument();
    });

    it('When text is typed and then cleared / Then the full list returns', async () => {
      await openCreateModal();
      const personField = screen.getByTestId('person-picker').querySelector('input') as HTMLInputElement;
      fireEvent.focus(personField);
      await waitFor(() => expect(screen.getByText(/Aswin Shaji/)).toBeInTheDocument());

      fireEvent.change(personField, { target: { value: 'ali' } });
      await waitFor(() => expect(screen.queryByText(/Aswin Shaji/)).not.toBeInTheDocument());

      fireEvent.change(personField, { target: { value: '' } });
      await waitFor(() => expect(screen.getByText(/Aswin Shaji/)).toBeInTheDocument());
    });

    it('When the search matches nobody / Then a no-results state is shown', async () => {
      await openCreateModal();
      const personField = screen.getByTestId('person-picker').querySelector('input') as HTMLInputElement;
      fireEvent.focus(personField);
      fireEvent.change(personField, { target: { value: 'zzzz' } });

      await waitFor(() => expect(screen.getByText('No matches found')).toBeInTheDocument());
    });
  });

  describe('Given no person has been selected yet', () => {
    it('When the modal opens / Then the reviewer field is disabled and explains why', async () => {
      await openCreateModal();
      const reviewerField = screen.getByTestId('reviewer-picker').querySelector('input') as HTMLInputElement;

      expect(reviewerField).toBeDisabled();
      expect(screen.getByText('Select the person being reviewed first.')).toBeInTheDocument();
      expect(mockReviewsApi.getEligibleReviewers).not.toHaveBeenCalled();
    });
  });

  describe('Given a person under review has been selected', () => {
    it('When the reviewer list loads / Then only eligible managers are offered, not general employees', async () => {
      await openCreateModal();
      await selectPerson('Alice');

      await waitFor(() => expect(mockReviewsApi.getEligibleReviewers).toHaveBeenCalledWith('p1'));

      const reviewerField = screen.getByTestId('reviewer-picker');
      await waitFor(() => expect(reviewerField.textContent).toContain('Manager Bob'));
      // Aswin Shaji is an ordinary employee — he must never surface as a reviewer.
      expect(reviewerField.textContent).not.toContain('Aswin Shaji');
    });

    it('When a direct manager is resolved / Then it is preselected', async () => {
      await openCreateModal();
      await selectPerson('Alice');

      await waitFor(() =>
        expect(screen.getByTestId('reviewer-picker').textContent).toContain('Manager Bob'),
      );
      expect(screen.getByText('Their reporting manager.')).toBeInTheDocument();
    });

    // No department heads means no eligibility data to restrict against, and
    // the backend stands its check down to match. Blocking here would take a
    // working flow away from orgs that simply have not modelled a hierarchy.
    it('When the org has no department heads / Then it warns rather than blocking', async () => {
      mockReviewsApi.getEligibleReviewers.mockResolvedValue({ data: [], direct_manager_id: null });
      await openCreateModal();
      await selectPerson('Alice');

      await waitFor(() =>
        expect(screen.getByText(/No department heads are configured/i)).toBeInTheDocument(),
      );
    });

    it('When the org has no department heads / Then any employee can still be chosen', async () => {
      mockReviewsApi.getEligibleReviewers.mockResolvedValue({ data: [], direct_manager_id: null });
      await openCreateModal();
      await selectPerson('Alice');
      await waitFor(() =>
        expect(screen.getByText(/No department heads are configured/i)).toBeInTheDocument(),
      );

      const reviewerField = screen.getByTestId('reviewer-picker').querySelector('input') as HTMLInputElement;
      fireEvent.focus(reviewerField);

      // Falls back to the full people list — minus the person under review,
      // who must never be offered as their own reviewer.
      await waitFor(() => expect(screen.getByText(/Aswin Shaji/)).toBeInTheDocument());
      expect(screen.getByTestId('reviewer-picker').textContent).not.toContain('Alice');
    });

    it('When the org HAS department heads / Then the list stays restricted to them', async () => {
      await openCreateModal();
      await selectPerson('Alice');
      await waitFor(() =>
        expect(screen.getByTestId('reviewer-picker').textContent).toContain('Manager Bob'),
      );

      expect(screen.queryByText(/No department heads are configured/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('reviewer-picker').textContent).not.toContain('Aswin Shaji');
    });

    it('When the person is changed / Then the reviewer list is refetched for the new person', async () => {
      await openCreateModal();
      await selectPerson('Alice');
      await waitFor(() => expect(mockReviewsApi.getEligibleReviewers).toHaveBeenCalledWith('p1'));

      // Two Clear controls exist once a reviewer is auto-selected; the first
      // belongs to the person field.
      fireEvent.click(screen.getAllByText('Clear')[0]);
      await selectPerson('Aswin Shaji');

      await waitFor(() => expect(mockReviewsApi.getEligibleReviewers).toHaveBeenCalledWith('p9'));
    });

    it('When the new person has different managers / Then a now-ineligible reviewer is cleared', async () => {
      await openCreateModal();
      await selectPerson('Alice');
      await waitFor(() =>
        expect(screen.getByTestId('reviewer-picker').textContent).toContain('Manager Bob'),
      );

      mockReviewsApi.getEligibleReviewers.mockResolvedValue({ data: [ZOE_MANAGER], direct_manager_id: null });
      fireEvent.click(screen.getAllByText('Clear')[0]);
      await selectPerson('Aswin Shaji');

      await waitFor(() =>
        expect(screen.getByTestId('reviewer-picker').textContent).not.toContain('Manager Bob'),
      );
    });
  });

  describe('Given a review period is being entered', () => {
    const dateInputs = () =>
      Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];

    it('When the end date is earlier than the start / Then a validation message is shown', async () => {
      await openCreateModal();
      const [start, end] = dateInputs();
      fireEvent.change(start, { target: { value: '2026-08-11' } });
      fireEvent.change(end, { target: { value: '2026-08-03' } });

      await waitFor(() =>
        expect(
          screen.getByText('Review Period End date cannot be earlier than Review Period Start date.'),
        ).toBeInTheDocument(),
      );
    });

    it('When the range is invalid / Then Create Review cannot submit', async () => {
      await openCreateModal();
      await selectPerson('Alice');
      await waitFor(() =>
        expect(screen.getByTestId('reviewer-picker').textContent).toContain('Manager Bob'),
      );
      // Scope to the form — the page renders its own status-filter select first.
      const form = document.querySelector('form') as HTMLFormElement;
      fireEvent.change(form.querySelector('select') as HTMLSelectElement, { target: { value: 'tpl1' } });

      const [start, end] = dateInputs();
      fireEvent.change(start, { target: { value: '2026-08-11' } });
      fireEvent.change(end, { target: { value: '2026-08-03' } });

      const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      await waitFor(() => expect(submit).toBeDisabled());

      // A disabled button still lets Enter-in-a-field submit the form, so the
      // handler itself must refuse.
      fireEvent.submit(form);
      expect(mockReviewsApi.create).not.toHaveBeenCalled();
    });

    it('When the end date is corrected / Then the validation message disappears', async () => {
      await openCreateModal();
      const [start, end] = dateInputs();
      fireEvent.change(start, { target: { value: '2026-08-11' } });
      fireEvent.change(end, { target: { value: '2026-08-03' } });
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

      fireEvent.change(end, { target: { value: '2026-08-20' } });
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });

    it('When a start date is chosen / Then the end picker cannot offer earlier dates', async () => {
      await openCreateModal();
      const [start, end] = dateInputs();
      fireEvent.change(start, { target: { value: '2026-08-11' } });

      await waitFor(() => expect(end.getAttribute('min')).toBe('2026-08-11'));
    });

    it('When start equals end / Then the range is accepted', async () => {
      await openCreateModal();
      const [start, end] = dateInputs();
      fireEvent.change(start, { target: { value: '2026-08-11' } });
      fireEvent.change(end, { target: { value: '2026-08-11' } });

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });
  });

  describe('Given optional deadlines are left blank', () => {
    it('When the review is created / Then empty deadline strings are omitted from the payload', async () => {
      mockReviewsApi.create.mockResolvedValue({ id: 'new-rv' });
      await openCreateModal();
      await selectPerson('Alice');
      await waitFor(() =>
        expect(screen.getByTestId('reviewer-picker').textContent).toContain('Manager Bob'),
      );

      // Scope to the form — the page itself renders a status-filter select first.
      const form = document.querySelector('form') as HTMLFormElement;
      fireEvent.change(form.querySelector('select') as HTMLSelectElement, { target: { value: 'tpl1' } });
      fireEvent.submit(form);

      await waitFor(() => expect(mockReviewsApi.create).toHaveBeenCalled());
      const payload = mockReviewsApi.create.mock.calls[0][0];
      expect(payload).not.toHaveProperty('self_review_deadline');
      expect(payload).not.toHaveProperty('manager_review_deadline');
      expect(payload.reviewer_id).toBe('p2');
    });
  });
});
