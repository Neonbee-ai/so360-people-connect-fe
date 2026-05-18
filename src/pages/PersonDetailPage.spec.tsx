import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getById: vi.fn(),
    update: vi.fn(),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    getEmploymentHistory: vi.fn(),
    getRateHistory: vi.fn(),
    linkUser: vi.fn(),
    inviteUser: vi.fn(),
  },
  allocationsApi: { getAll: vi.fn() },
  timeEntriesApi: { getAll: vi.fn() },
}));

vi.mock('../services/goalsService', () => ({
  goalsApi: { getAll: vi.fn() },
  Goal: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
}));

import PersonDetailPage from './PersonDetailPage';
import { peopleApi, allocationsApi, timeEntriesApi } from '../services/peopleService';
import { goalsApi } from '../services/goalsService';

const mockPeopleApi = peopleApi as any;
const mockAllocApi = allocationsApi as any;
const mockTimeApi = timeEntriesApi as any;
const mockGoalsApi = goalsApi as any;

const renderPage = (id = 'p1') =>
  render(
    <MemoryRouter initialEntries={[`/people/${id}`]}>
      <Routes>
        <Route path="/people/:id" element={<PersonDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

const mockPerson = {
  id: 'p1',
  full_name: 'Alice Smith',
  email: 'alice@test.com',
  job_title: 'Engineer',
  department: 'Engineering',
  type: 'employee',
  status: 'active',
  cost_rate: 100,
  cost_rate_unit: 'hour',
  currency: 'USD',
  available_hours_per_day: 8,
  available_days_per_week: 5,
  people_roles: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockGoalsApi.getAll.mockResolvedValue({ data: [] });
});

describe('Given PersonDetailPage loads successfully', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockResolvedValue(mockPerson);
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getAll.mockResolvedValue({ data: [] });
  });

  it('When page loads / Then person full name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When page loads / Then job title is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineer')).toBeInTheDocument());
  });

  it('When page loads / Then status badge is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
  });

  it('When page loads / Then email is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
  });
});

describe('Given PersonDetailPage API failure', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockRejectedValue(new Error('Not found'));
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getAll.mockResolvedValue({ data: [] });
  });

  it('When person load fails / Then error toast is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Person not found.')).toBeInTheDocument());
  });
});

describe('Given PersonDetailPage tab navigation', () => {
  beforeEach(() => {
    mockPeopleApi.getById.mockResolvedValue(mockPerson);
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockTimeApi.getAll.mockResolvedValue({ data: [] });
  });

  it('When page loads / Then the overview tab is active by default', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });
});
