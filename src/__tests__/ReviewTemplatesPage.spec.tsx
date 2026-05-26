import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), clone: vi.fn() },
  ReviewTemplate: {},
  CreateReviewTemplatePayload: {},
}));


vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

import ReviewTemplatesPage from '../pages/ReviewTemplatesPage';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';

const mockApi = reviewTemplatesApi as any;

const renderPage = () => render(<MemoryRouter><ReviewTemplatesPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('ReviewTemplatesPage', () => {
  describe('Given templates exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          {
            id: 'rt1', name: 'Annual Review', description: 'Standard annual review',
            review_type: 'annual', rating_scale: 5, sections: [],
            requires_self_review: true, requires_manager_review: true, is_active: true,
          },
        ],
      });
    });

    it('When the page loads / Then it renders the templates table', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Annual Review')).toBeInTheDocument());
      expect(screen.getByText('Standard annual review')).toBeInTheDocument();
    });

    it('When Create Template is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Annual Review')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Create Template'));
      await waitFor(() => expect(screen.getByText('Create Review Template')).toBeInTheDocument());
    });

    it('When Edit is clicked / Then the edit modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => expect(screen.getByText('Edit Review Template')).toBeInTheDocument());
    });
  });

  describe('Given no templates exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No review templates found')).toBeInTheDocument());
    });
  });
});
