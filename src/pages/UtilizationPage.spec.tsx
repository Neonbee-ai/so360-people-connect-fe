import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  utilizationApi: {
    getAll: vi.fn(),
    getSummary: vi.fn(),
  },
}));

import UtilizationPage from './UtilizationPage';
import { utilizationApi } from '../services/peopleService';

const mockApi = utilizationApi as any;

const renderPage = () => render(<MemoryRouter><UtilizationPage /></MemoryRouter>);

const mockUtilData = {
  person: {
    id: 'p1',
    full_name: 'Alice Smith',
    email: 'alice@test.com',
    job_title: 'Engineer',
    status: 'active',
    cost_rate: 100,
    available_hours_per_day: 8,
  },
  utilization: {
    available_hours: 40,
    planned_hours: 32,
    actual_hours: 30,
    actual_cost: 3000,
    utilization_pct: 75,
    allocation_pct: 80,
    variance_hours: 2,
    is_idle: false,
    is_overallocated: false,
  },
};

const mockSummary = {
  total_people: 10,
  active_allocations: 8,
  avg_utilization_pct: 72,
  total_hours_this_week: 340,
  total_cost_this_week: 17000,
  pending_approvals: 2,
  burn_rate_daily: 3400,
  period: { start: '2024-06-10', end: '2024-06-14' },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given UtilizationPage loads with data', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockUtilData], period: { start: '2024-06-10', end: '2024-06-14' } });
    mockApi.getSummary.mockResolvedValue(mockSummary);
  });

  it('When page loads / Then "Utilization" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Utilization Intelligence')).toBeInTheDocument());
  });

  it('When summary loads / Then stat cards are shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Active Resources')).toBeInTheDocument());
  });

  it('When utilization data loads / Then person name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When utilization data loads / Then utilization percentage is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/75%/)).toBeInTheDocument());
  });
});

describe('Given UtilizationPage with no utilization data', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], period: { start: '2024-06-10', end: '2024-06-14' } });
    mockApi.getSummary.mockResolvedValue(mockSummary);
  });

  it('When no utilization data exists / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No utilization data/i)).toBeInTheDocument());
  });
});

describe('Given UtilizationPage API failure', () => {
  beforeEach(() => {
    mockApi.getAll.mockRejectedValue(new Error('Failed'));
    mockApi.getSummary.mockRejectedValue(new Error('Failed'));
  });

  it('When API fails / Then error toast appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load utilization data')).toBeInTheDocument());
  });
});
