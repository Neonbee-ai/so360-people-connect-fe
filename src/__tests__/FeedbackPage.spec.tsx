import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/feedbackService', () => ({
  feedbackApi: { getAll: vi.fn(), create: vi.fn(), acknowledge: vi.fn() },
  Feedback: {},
  CreateFeedbackPayload: {},
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn() },
}));

vi.mock('../services/apiClient', () => ({
  apiContext: { getUserId: () => 'u1' },
}));


vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),}));

import FeedbackPage from '../pages/FeedbackPage';
import { feedbackApi } from '../services/feedbackService';
import { peopleApi } from '../services/peopleService';

const mockFeedback = feedbackApi as any;
const mockPeople = peopleApi as any;

const renderPage = () => render(<MemoryRouter><FeedbackPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('FeedbackPage', () => {
  describe('Given feedback entries exist', () => {
    beforeEach(() => {
      mockFeedback.getAll.mockResolvedValue({
        data: [
          {
            id: 'fb1', feedback_type: 'positive', feedback_text: 'Excellent work', is_anonymous: false,
            is_visible_to_subject: true, overall_rating: 5, acknowledged_at: null, created_at: '2025-01-15',
            provider_relationship: 'peer', strengths: 'Leadership', areas_for_improvement: 'Communication',
            person: { id: 'p1', full_name: 'Alice' }, provider: { id: 'u1', full_name: 'Bob' },
          },
          {
            id: 'fb2', feedback_type: 'constructive', feedback_text: 'Needs improvement', is_anonymous: true,
            is_visible_to_subject: false, overall_rating: null, acknowledged_at: '2025-01-20', created_at: '2025-01-14',
            person: { id: 'p2', full_name: 'Charlie' }, provider: { id: 'u2', full_name: 'Dave' },
          },
        ],
      });
    });

    it('When the page loads / Then it renders feedback cards', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Excellent work')).toBeInTheDocument());
      expect(screen.getByText('Needs improvement')).toBeInTheDocument();
    });

    it('When feedback is not acknowledged / Then it shows the Acknowledge button', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Acknowledge')).toBeInTheDocument());
    });

    it('When feedback is acknowledged / Then it shows the acknowledged date', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText(/Acknowledged on/)).toBeInTheDocument());
    });

    it('When anonymous feedback exists / Then it shows Anonymous', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Excellent work')).toBeInTheDocument());
      expect(screen.getByText(/Anonymous/)).toBeInTheDocument();
    });

    it('When feedback has strengths / Then it shows strengths', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText(/Leadership/)).toBeInTheDocument());
    });

    it('When acknowledge is clicked / Then it calls the API', async () => {
      mockFeedback.acknowledge.mockResolvedValue({});
      renderPage();
      await waitFor(() => expect(screen.getByText('Acknowledge')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Acknowledge'));
      await waitFor(() => expect(mockFeedback.acknowledge).toHaveBeenCalledWith('fb1'));
    });
  });

  describe('Given no feedback exists', () => {
    beforeEach(() => {
      mockFeedback.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No feedback yet')).toBeInTheDocument());
    });
  });

  describe('Given the Give Feedback button is clicked', () => {
    beforeEach(() => {
      mockFeedback.getAll.mockResolvedValue({ data: [] });
      mockPeople.getAll.mockResolvedValue({ data: [{ id: 'p1', full_name: 'Alice' }] });
    });

    it('When the button is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Give Feedback')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Give Feedback'));
      await waitFor(() => expect(screen.getByText('Feedback For *')).toBeInTheDocument());
    });
  });
});
