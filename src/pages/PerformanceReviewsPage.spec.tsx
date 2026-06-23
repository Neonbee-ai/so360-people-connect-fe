import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/performanceReviewsService', () => ({
  performanceReviewsApi: {
    getAll: vi.fn(),
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
