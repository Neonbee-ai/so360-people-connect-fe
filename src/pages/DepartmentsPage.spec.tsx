import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/departmentsService', () => ({
  departmentsApi: {
    getAll: vi.fn(),
    getTree: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

import DepartmentsPage from './DepartmentsPage';
import { departmentsApi } from '../services/departmentsService';

const mockApi = departmentsApi as any;

const renderPage = () => render(
    <MemoryRouter initialEntries={['/departments']}>
        <Routes>
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/departments/:id" element={<div>Department Detail</div>} />
        </Routes>
    </MemoryRouter>
);

const mockDept = { id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, employee_count: 5, children: [] };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given DepartmentsPage loads successfully', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockDept], total: 1 });
    mockApi.getTree.mockResolvedValue({ data: [mockDept] });
  });

  it('When page loads / Then "Departments" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Departments')).toBeInTheDocument());
  });

  it('When departments are fetched / Then department names are displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
  });

  it('When departments are fetched / Then department codes are displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ENG')).toBeInTheDocument());
  });
});

describe('Given DepartmentsPage with no departments', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
    mockApi.getTree.mockResolvedValue({ data: [] });
  });

  it('When there are no departments / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No departments found/i)).toBeInTheDocument());
  });
});

describe('Given DepartmentsPage API failure', () => {
  beforeEach(() => {
    mockApi.getAll.mockImplementation(async () => { throw new Error('Server error'); });
    mockApi.getTree.mockImplementation(async () => { throw new Error('Server error'); });
  });

  it('When API fails / Then page renders without crashing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Departments')).toBeInTheDocument());
  });
});

describe('Given DepartmentsPage create interaction', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockDept], total: 1 });
    mockApi.getTree.mockResolvedValue({ data: [mockDept] });
  });

  it('When Add Department button is clicked / Then create modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Department'));
    await waitFor(() => expect(screen.getByText(/Code/i)).toBeInTheDocument());
  });
});

/*
 * Regression: clicking a department card previously called
 * navigate('/departments/<id>') which — because the people-connect MFE is
 * mounted under the shell at '/people/*' — escaped the module prefix and
 * resolved to the shell root, hitting the shell's "Page Not Found" (so
 * clicking a department appeared to do nothing). The correct target is
 * '/people/departments/<id>'.
 */
describe('Given DepartmentsPage department card click navigation', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockDept], total: 1 });
    mockApi.getTree.mockResolvedValue({ data: [mockDept] });
  });

  it('When department name area is clicked / Then it navigates to the shell-prefixed detail route', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Engineering'));
    expect(mockNavigate).toHaveBeenCalledWith('/people/departments/d1');
  });

  it('When department name area is clicked / Then it does NOT navigate to the bare /departments path (regression guard: was hitting the shell 404)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Engineering'));
    expect(mockNavigate).not.toHaveBeenCalledWith('/departments/d1');
  });
});
