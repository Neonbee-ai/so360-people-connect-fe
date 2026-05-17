import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  timeEntriesApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
  peopleApi: { getAll: vi.fn() },
  allocationsApi: { getAll: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
}));

import TimeEntriesPage from './TimeEntriesPage';
import { timeEntriesApi, peopleApi, allocationsApi } from '../services/peopleService';

const mockTimeApi = timeEntriesApi as any;
const mockPeopleApi = peopleApi as any;
const mockAllocApi = allocationsApi as any;

const renderPage = () => render(<MemoryRouter><TimeEntriesPage /></MemoryRouter>);

const mockEntry = {
  id: 'te1',
  person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' },
  entity_name: 'Project X',
  entity_type: 'project',
  work_date: '2024-06-15',
  hours: 8,
  total_cost: 800,
  currency: 'USD',
  status: 'draft',
  description: 'Feature development',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
  mockAllocApi.getAll.mockResolvedValue({ data: [] });
});

describe('Given TimeEntriesPage loads with entries', () => {
  beforeEach(() => {
    mockTimeApi.getAll.mockResolvedValue({ data: [mockEntry], total: 1 });
  });

  it('When page loads / Then "Time Entries" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Time Entries')).toBeInTheDocument());
  });

  it('When entries are fetched / Then person name is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('When entries are fetched / Then entity name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Project X')).toBeInTheDocument());
  });

  it('When entries are fetched / Then hours are shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/8h/)).toBeInTheDocument());
  });
});

describe('Given TimeEntriesPage with no entries', () => {
  beforeEach(() => {
    mockTimeApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no entries exist / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No time entries/i)).toBeInTheDocument());
  });
});

describe('Given TimeEntriesPage status filter', () => {
  beforeEach(() => {
    mockTimeApi.getAll.mockResolvedValue({ data: [mockEntry], total: 1 });
  });

  it('When status filter changes / Then API is called with new status', async () => {
    renderPage();
    await waitFor(() => expect(mockTimeApi.getAll).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'approved' } });
    await waitFor(() =>
      expect(mockTimeApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }))
    );
  });
});

describe('Given TimeEntriesPage API failure', () => {
  beforeEach(() => {
    mockTimeApi.getAll.mockRejectedValue(new Error('Failed'));
  });

  it('When API fails / Then error toast is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load time entries')).toBeInTheDocument());
  });
});
