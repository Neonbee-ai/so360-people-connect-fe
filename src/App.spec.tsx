import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@so360/shell-context', () => ({
  useShellBridge: vi.fn(),
  useActivity: () => ({ recordActivity: async () => {} }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

vi.mock('./services/peopleService', () => ({
  peopleService: {
    setTenantId: vi.fn(),
    setOrgId: vi.fn(),
    setAccessToken: vi.fn(),
    setUser: vi.fn(),
  },
  utilizationApi: { getSummary: vi.fn() },
  timeEntriesApi: { getAll: vi.fn() },
  eventsApi: { getAll: vi.fn() },
}));

// Mock all lazy-loaded pages to avoid rendering their service calls
vi.mock('./pages/DashboardPage', () => ({ default: () => React.createElement('div', null, 'DashboardPage') }));
vi.mock('./pages/PeoplePage', () => ({ default: () => React.createElement('div', null, 'PeoplePage') }));
vi.mock('./pages/PersonDetailPage', () => ({ default: () => React.createElement('div', null, 'PersonDetailPage') }));
vi.mock('./pages/AllocationsPage', () => ({ default: () => React.createElement('div', null, 'AllocationsPage') }));
vi.mock('./pages/TimeEntriesPage', () => ({ default: () => React.createElement('div', null, 'TimeEntriesPage') }));
vi.mock('./pages/UtilizationPage', () => ({ default: () => React.createElement('div', null, 'UtilizationPage') }));
vi.mock('./pages/EventsPage', () => ({ default: () => React.createElement('div', null, 'EventsPage') }));
vi.mock('./pages/DepartmentsPage', () => ({ default: () => React.createElement('div', null, 'DepartmentsPage') }));
vi.mock('./pages/LeaveTypesPage', () => ({ default: () => React.createElement('div', null, 'LeaveTypesPage') }));
vi.mock('./pages/LeaveRequestsPage', () => ({ default: () => React.createElement('div', null, 'LeaveRequestsPage') }));
vi.mock('./pages/LeaveCalendarPage', () => ({ default: () => React.createElement('div', null, 'LeaveCalendarPage') }));
vi.mock('./pages/LeaveApprovalsPage', () => ({ default: () => React.createElement('div', null, 'LeaveApprovalsPage') }));
vi.mock('./pages/ReviewTemplatesPage', () => ({ default: () => React.createElement('div', null, 'ReviewTemplatesPage') }));
vi.mock('./pages/PerformanceReviewsPage', () => ({ default: () => React.createElement('div', null, 'PerformanceReviewsPage') }));
vi.mock('./pages/ReviewDetailPage', () => ({ default: () => React.createElement('div', null, 'ReviewDetailPage') }));
vi.mock('./pages/GoalsPage', () => ({ default: () => React.createElement('div', null, 'GoalsPage') }));
vi.mock('./pages/TeamPerformancePage', () => ({ default: () => React.createElement('div', null, 'TeamPerformancePage') }));
vi.mock('./pages/FeedbackPage', () => ({ default: () => React.createElement('div', null, 'FeedbackPage') }));
vi.mock('./pages/ImportExportPage', () => ({ default: () => React.createElement('div', null, 'ImportExportPage') }));

import App from './App';
import { useShellBridge } from '@so360/shell-context';

const mockUseShellBridge = useShellBridge as ReturnType<typeof vi.fn>;

const mockShell = {
  currentTenant: { id: 't1', name: 'Acme' },
  currentOrg: { id: 'o1', name: 'Org A' },
  user: { id: 'u1', email: 'user@test.com', full_name: 'Test User' },
  accessToken: 'token-123',
};

const renderApp = (initialPath = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  mockUseShellBridge.mockReturnValue(mockShell);
});

describe('Given App with valid shell context', () => {
  it('When navigating to /dashboard / Then DashboardPage is rendered', async () => {
    renderApp('/dashboard');
    await waitFor(() => expect(screen.getByText('DashboardPage')).toBeInTheDocument());
  });

  it('When navigating to /people / Then PeoplePage is rendered', async () => {
    renderApp('/people');
    await waitFor(() => expect(screen.getByText('PeoplePage')).toBeInTheDocument());
  });

  it('When navigating to /departments / Then DepartmentsPage is rendered', async () => {
    renderApp('/departments');
    await waitFor(() => expect(screen.getByText('DepartmentsPage')).toBeInTheDocument());
  });

  it('When navigating to /leaves/requests / Then LeaveRequestsPage is rendered', async () => {
    renderApp('/leaves/requests');
    await waitFor(() => expect(screen.getByText('LeaveRequestsPage')).toBeInTheDocument());
  });

  it('When navigating to /goals / Then GoalsPage is rendered', async () => {
    renderApp('/goals');
    await waitFor(() => expect(screen.getByText('GoalsPage')).toBeInTheDocument());
  });
});

describe('Given App with missing shell context', () => {
  it('When shell context is not ready / Then syncing spinner is shown', async () => {
    mockUseShellBridge.mockReturnValue(null);
    renderApp('/dashboard');
    await waitFor(() => expect(screen.getByText('Connecting to shell context...')).toBeInTheDocument());
  });

  it('When tenant is missing / Then connecting spinner is shown', async () => {
    mockUseShellBridge.mockReturnValue({ currentTenant: null, currentOrg: null, user: null });
    renderApp('/dashboard');
    await waitFor(() => expect(screen.getByText('Connecting to shell context...')).toBeInTheDocument());
  });
});

describe('Given App root redirect', () => {
  it('When navigating to / (root) / Then it redirects to dashboard', async () => {
    renderApp('/');
    await waitFor(() => expect(screen.getByText('DashboardPage')).toBeInTheDocument());
  });
});
