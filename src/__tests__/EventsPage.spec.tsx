import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/peopleService', () => ({
  eventsApi: { getAll: vi.fn() },
}));

import EventsPage from '../pages/EventsPage';
import { eventsApi } from '../services/peopleService';

const mockApi = eventsApi as any;

const renderPage = () => render(<MemoryRouter><EventsPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('EventsPage', () => {
  describe('Given events exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          { id: 'e1', event_type: 'person_created', actor_name: 'Admin', occurred_at: new Date().toISOString(), entity_type: 'person', entity_id: 'p1', payload: { full_name: 'Alice', type: 'employee' } },
          { id: 'e2', event_type: 'time_logged', actor_name: 'Bob', occurred_at: new Date().toISOString(), entity_type: 'project', entity_id: 'pr1', payload: { hours: 4, entity_name: 'Project X' } },
          { id: 'e3', event_type: 'person_allocated', actor_name: 'Admin', occurred_at: new Date().toISOString(), entity_type: 'project', entity_id: 'pr1', payload: { allocation_pct: 50, entity_name: 'Project Y' } },
          { id: 'e4', event_type: 'timesheet_approved', actor_name: 'Manager', occurred_at: new Date().toISOString(), entity_type: 'project', entity_id: 'pr2', payload: { hours: 8, total_cost: 400, entity_name: 'Project Z' } },
          { id: 'e5', event_type: 'person_released', actor_name: 'System', occurred_at: new Date().toISOString(), entity_type: 'allocation', entity_id: 'a1', payload: { reason: 'contract ended' } },
        ],
        meta: { total: 5 },
      });
    });

    it('When the page loads / Then it renders event items', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Person Created')).toBeInTheDocument());
      expect(screen.getAllByText('Time Logged').length).toBeGreaterThan(0);
    });

    it('When the page loads / Then it shows the total count', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('5 events total')).toBeInTheDocument());
    });

    it('When an event type filter is selected / Then it reloads with the filter', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Person Created')).toBeInTheDocument());
      fireEvent.change(screen.getByDisplayValue('All Event Types'), { target: { value: 'time_logged' } });
      await waitFor(() => expect(mockApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'time_logged' })));
    });
  });

  describe('Given no events exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [], meta: { total: 0 } });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No events')).toBeInTheDocument());
    });
  });

  describe('Given API fails', () => {
    beforeEach(() => {
      mockApi.getAll.mockRejectedValue(new Error('fail'));
    });

    it('When loading fails / Then it shows the error toast', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('People Events')).toBeInTheDocument());
      expect(screen.getByText('Failed to load events')).toBeInTheDocument();
    });
  });
});
