import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  eventsApi: { getAll: vi.fn() },
}));

import EventsPage from './EventsPage';
import { eventsApi } from '../services/peopleService';

const mockApi = eventsApi as any;

const renderPage = () => render(<MemoryRouter><EventsPage /></MemoryRouter>);

const mockEvent = {
  id: 'ev1',
  event_type: 'person_created',
  actor_name: 'Admin',
  occurred_at: '2024-06-01T10:00:00Z',
  payload: { full_name: 'Alice Smith' },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given EventsPage loads successfully', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockEvent], total: 1 });
  });

  it('When page loads / Then "Events" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Events')).toBeInTheDocument());
  });

  it('When events are fetched / Then event actor name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument());
  });

  it('When events are fetched / Then event type label is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/New Person|person_created/i)).toBeInTheDocument());
  });
});

describe('Given EventsPage with no events', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no events exist / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No events/i)).toBeInTheDocument());
  });
});

describe('Given EventsPage API failure', () => {
  beforeEach(() => {
    mockApi.getAll.mockRejectedValue(new Error('Failed to load'));
  });

  it('When API fails / Then page renders without crashing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Events')).toBeInTheDocument());
  });
});

describe('Given EventsPage with multiple event types', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({
      data: [
        { ...mockEvent, id: 'ev2', event_type: 'time_logged', actor_name: 'Bob' },
        { ...mockEvent, id: 'ev3', event_type: 'person_released', actor_name: 'Carol' },
      ],
      total: 2,
    });
  });

  it('When multiple events are loaded / Then all actor names are shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });
});
