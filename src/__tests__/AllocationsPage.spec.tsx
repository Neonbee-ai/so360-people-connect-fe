import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/peopleService', () => ({
  allocationsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
  peopleApi: { getAll: vi.fn() },
}));

import AllocationsPage from '../pages/AllocationsPage';
import { allocationsApi, peopleApi } from '../services/peopleService';

const mockAllocApi = allocationsApi as any;
const mockPeopleApi = peopleApi as any;

const renderPage = () =>
  render(<MemoryRouter><AllocationsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
});

describe('AllocationsPage', () => {
  describe('Given allocations are loaded', () => {
    beforeEach(() => {
      mockAllocApi.getAll.mockResolvedValue({
        data: [
          { id: 'a1', person_id: 'p1', person: { full_name: 'Alice' }, entity_type: 'project', entity_id: 'proj-1', entity_name: 'Website', start_date: '2026-01-01', end_date: '2026-06-30', allocation_type: 'percentage', allocation_value: 80, allocation_period: 'daily', status: 'active', notes: '' },
          { id: 'a2', person_id: 'p1', person: { full_name: 'Alice' }, entity_type: 'project', entity_id: 'proj-2', entity_name: 'Mobile App', start_date: '2026-01-01', end_date: '2026-06-30', allocation_type: 'percentage', allocation_value: 40, allocation_period: 'daily', status: 'active', notes: '' },
        ],
      });
    });

    it('When the page loads / Then allocation cards are rendered', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
      expect(screen.getByText('Mobile App')).toBeInTheDocument();
    });

    it('When a person is overallocated / Then a warning is shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getAllByText(/120% allocated/).length).toBeGreaterThan(0));
    });

    it('When the status filter is changed / Then allocations are re-fetched', async () => {
      renderPage();
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalled());
      fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'active' } });
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' })));
    });

    it('When the summary stats are displayed / Then they count correctly', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('2 allocations')).toBeInTheDocument());
      expect(screen.getByText('2 active')).toBeInTheDocument();
    });
  });

  describe('Given no allocations exist', () => {
    beforeEach(() => {
      mockAllocApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then the empty state is shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No allocations')).toBeInTheDocument());
    });
  });
});
