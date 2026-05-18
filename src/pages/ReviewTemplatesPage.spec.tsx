import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    clone: vi.fn(),
  },
  ReviewTemplate: {},
  CreateReviewTemplatePayload: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
}));

import ReviewTemplatesPage from './ReviewTemplatesPage';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';

const mockApi = reviewTemplatesApi as any;

const renderPage = () => render(<MemoryRouter><ReviewTemplatesPage /></MemoryRouter>);

const mockTemplate = {
  id: 'tpl1',
  name: 'Annual 2024',
  review_type: 'annual',
  rating_scale: 5,
  requires_self_review: true,
  requires_manager_review: true,
  is_active: true,
  sections: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given ReviewTemplatesPage loads with templates', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockTemplate], total: 1 });
  });

  it('When page loads / Then "Review Templates" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Review Templates')).toBeInTheDocument());
  });

  it('When templates are fetched / Then template name is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual 2024')).toBeInTheDocument());
  });

  it('When templates are fetched / Then review type is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('annual')).toBeInTheDocument());
  });
});

describe('Given ReviewTemplatesPage with no templates', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no templates exist / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No review templates/i)).toBeInTheDocument());
  });
});

describe('Given ReviewTemplatesPage create interaction', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockTemplate], total: 1 });
  });

  it('When Create Template is clicked / Then create modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual 2024')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Template'));
    await waitFor(() => expect(screen.getByText('Name *')).toBeInTheDocument());
  });
});

describe('Given ReviewTemplatesPage API failure', () => {
  beforeEach(() => {
    mockApi.getAll.mockRejectedValue(new Error('Server error'));
  });

  it('When API fails / Then error toast appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Failed to load/i)).toBeInTheDocument());
  });
});
