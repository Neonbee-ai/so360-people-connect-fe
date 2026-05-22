import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  LeaveType: {},
  CreateLeaveTypePayload: {},
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import LeaveTypesPage from './LeaveTypesPage';
import { leaveTypesApi } from '../services/leaveTypesService';

const mockApi = leaveTypesApi as any;

const renderPage = () => render(<MemoryRouter><LeaveTypesPage /></MemoryRouter>);

const mockLeaveType = {
  id: 'lt1',
  code: 'AL',
  name: 'Annual Leave',
  is_paid: true,
  requires_approval: true,
  accrual_type: 'annual',
  carry_forward_allowed: true,
  max_days_per_year: 20,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given LeaveTypesPage loads with leave types', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockLeaveType], total: 1 });
  });

  it('When page loads / Then "Leave Types" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Leave Types')).toBeInTheDocument());
  });

  it('When leave types are fetched / Then leave type name is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
  });

  it('When leave types are fetched / Then leave type code is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('AL')).toBeInTheDocument());
  });

  it('When leave types are fetched / Then max days is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/20/)).toBeInTheDocument());
  });
});

describe('Given LeaveTypesPage with no leave types', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no leave types exist / Then empty state is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No leave types/i)).toBeInTheDocument());
  });
});

describe('Given LeaveTypesPage create interaction', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockLeaveType], total: 1 });
  });

  it('When Add Leave Type is clicked / Then the create modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Leave Type'));
    await waitFor(() => expect(screen.getByText('Code *')).toBeInTheDocument());
  });
});

describe('Given LeaveTypesPage API failure', () => {
  beforeEach(() => {
    mockApi.getAll.mockRejectedValue(new Error('Failed'));
  });

  it('When API fails / Then error toast is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load leave types')).toBeInTheDocument());
  });
});
