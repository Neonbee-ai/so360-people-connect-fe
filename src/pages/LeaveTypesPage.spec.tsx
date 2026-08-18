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

  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

import LeaveTypesPage from './LeaveTypesPage';
import { leaveTypesApi } from '../services/leaveTypesService';
import { toast } from '@so360/design-system';

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
    mockApi.getAll.mockImplementation(async () => { throw new Error('Failed'); });
  });

  it('When API fails / Then error toast is shown', async () => {
    const toastErrorSpy = vi.spyOn(toast, 'error');
    renderPage();
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalledWith('Failed to load leave types'));
  });
});

/*
 * Row-interaction standardisation: the Actions column owns editing. The whole
 * row used to be clickable *as well*, so inspecting a value (code, accrual,
 * status) navigated into the edit form by accident.
 */
describe('Given a Leave Type row with a dedicated Edit action', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockLeaveType], total: 1 });
  });

  it('When the Edit action is clicked / Then the edit modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByText('Edit Leave Type')).toBeInTheDocument());
  });

  it('When the row name cell is clicked / Then no edit modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Annual Leave'));
    expect(screen.queryByText('Edit Leave Type')).not.toBeInTheDocument();
  });

  it('When the row code cell is clicked / Then no edit modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('AL')).toBeInTheDocument());
    fireEvent.click(screen.getByText('AL'));
    expect(screen.queryByText('Edit Leave Type')).not.toBeInTheDocument();
  });

  it('When the row is rendered / Then it carries no whole-row click affordance', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    const row = screen.getByText('Annual Leave').closest('tr') as HTMLTableRowElement;
    expect(row.className).not.toContain('cursor-pointer');
  });
});
