import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn().mockResolvedValue({ data: [], total: 0 }) },
}));

vi.mock('../services/feedbackService', () => ({
  feedbackApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    acknowledge: vi.fn(),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
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

import FeedbackPage from './FeedbackPage';
import { feedbackApi } from '../services/feedbackService';
import { peopleApi } from '../services/peopleService';

const mockApi = feedbackApi as any;
const mockPeopleApi = peopleApi as any;

const renderPage = () => render(<MemoryRouter><FeedbackPage /></MemoryRouter>);

const mockFeedback = {
  id: 'f1',
  person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' },
  provider: { id: 'p2', full_name: 'Manager Bob' },
  feedback_type: 'positive',
  feedback_text: 'Alice did an excellent job.',
  overall_rating: 4,
  is_anonymous: false,
  is_visible_to_subject: true,
  created_at: '2024-06-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  // Re-initialize after resetAllMocks so the modal's people selector doesn't
  // get undefined.data when FeedbackPage calls peopleApi.getAll().
  mockPeopleApi.getAll.mockResolvedValue({ data: [], total: 0 });
});

describe('Given FeedbackPage loads successfully', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockFeedback], total: 1 });
  });

  it('When page loads / Then "Feedback" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Feedback')).toBeInTheDocument());
  });

  it('When feedback is fetched / Then feedback recipient is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText((_, el) => el?.tagName === 'P' && (el?.textContent ?? '').replace(/\s+/g, ' ').trim() === 'Manager Bob to Alice')).toBeInTheDocument());
  });

  it('When feedback is fetched / Then feedback text is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice did an excellent job.')).toBeInTheDocument());
  });
});

describe('Given FeedbackPage with no feedback', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no feedback exists / Then empty state is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No feedback/i)).toBeInTheDocument());
  });
});

describe('Given FeedbackPage API failure', () => {
  beforeEach(() => {
    mockApi.getAll.mockImplementation(async () => { throw new Error('Network failure'); });
  });

  it('When API fails / Then page renders without crashing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Feedback')).toBeInTheDocument());
  });
});

describe('Given FeedbackPage create interaction', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockFeedback], total: 1 });
  });

  it('When Give Feedback button is clicked / Then create modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Give Feedback')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Give Feedback'));
    await waitFor(() => expect(screen.getByText('Feedback Type *')).toBeInTheDocument());
  });
});

/*
 * The "Feedback For" field is the same shared PersonPicker used by the Reviews
 * modal — it must open its list on focus rather than demanding a keystroke,
 * and it must not offer to edit the person's master record.
 */
describe('Given the Give Feedback modal person selector', () => {
  const PEOPLE = [
    { id: 'p1', full_name: 'Alice Anderson', job_title: 'Engineer' },
    { id: 'p2', full_name: 'Aswin Shaji', job_title: 'Developer' },
  ];

  const openModal = async () => {
    mockApi.getAll.mockResolvedValue({ data: [mockFeedback], total: 1 });
    mockPeopleApi.getAll.mockResolvedValue({ data: PEOPLE, total: 2 });
    renderPage();
    await waitFor(() => expect(screen.getByText('Give Feedback')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Give Feedback'));
    await waitFor(() => expect(screen.getByTestId('feedback-person-picker')).toBeInTheDocument());
  };

  const pickerInput = () =>
    screen.getByTestId('feedback-person-picker').querySelector('input') as HTMLInputElement;

  it('When the field is focused without typing / Then the people list opens', async () => {
    await openModal();
    expect(screen.queryByText(/Aswin Shaji/)).not.toBeInTheDocument();

    fireEvent.focus(pickerInput());

    await waitFor(() => expect(screen.getByText(/Alice Anderson/)).toBeInTheDocument());
    expect(screen.getByText(/Aswin Shaji/)).toBeInTheDocument();
  });

  it('When typing then clearing / Then the list filters and is restored', async () => {
    await openModal();
    fireEvent.focus(pickerInput());
    await waitFor(() => expect(screen.getByText(/Aswin Shaji/)).toBeInTheDocument());

    fireEvent.change(pickerInput(), { target: { value: 'alice' } });
    await waitFor(() => expect(screen.queryByText(/Aswin Shaji/)).not.toBeInTheDocument());

    fireEvent.change(pickerInput(), { target: { value: '' } });
    await waitFor(() => expect(screen.getByText(/Aswin Shaji/)).toBeInTheDocument());
  });

  it('When a person is selected / Then Clear is offered and no Edit action appears', async () => {
    await openModal();
    fireEvent.focus(pickerInput());
    fireEvent.click(await screen.findByText(/Alice Anderson/));

    await waitFor(() =>
      expect(screen.getByTestId('feedback-person-picker').textContent).toContain('Alice Anderson'),
    );
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-person-picker').textContent).not.toContain('Edit');
  });
});
