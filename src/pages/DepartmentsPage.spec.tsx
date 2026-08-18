import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { toast } from '@so360/design-system';
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

const { mockRefreshQuota } = vi.hoisted(() => ({ mockRefreshQuota: vi.fn(async () => {}) }));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: mockRefreshQuota }),
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

/*
 * Regression: the "Parent Department" dropdown used to be populated straight
 * from the root-level tree array, so only top-level departments were ever
 * selectable as a parent — a department nested one level down could never
 * itself become a parent, capping real nesting at depth 2 regardless of
 * what the backend/DB supported. The dropdown must now be built from the
 * FULLY FLATTENED tree (every depth), indented, and must exclude the
 * department being edited plus all of its descendants (self-parenting /
 * cycles).
 */
describe('Given DepartmentsPage Parent Department selector with a nested tree', () => {
  // Engineering (d1) -> QA (d2) -> Automation (d3)
  const automation = { id: 'd3', name: 'Automation', code: 'AUTO', is_active: true, employee_count: 0, children: [] };
  const qa = { id: 'd2', name: 'QA', code: 'QAD', is_active: true, employee_count: 1, children: [automation] };
  const engineering = { ...mockDept, children: [qa] };

  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [engineering], total: 1 });
    mockApi.getTree.mockResolvedValue({ data: [engineering] });
  });

  it('When a parent is selected while creating a department / Then the full reporting path breadcrumb is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('QA')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Department'));
    await waitFor(() => expect(screen.getByText(/Parent Department/i)).toBeInTheDocument());

    const select = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.querySelectorAll('option')).some((o) => o.textContent?.includes('Automation')),
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'd3' } }); // Automation

    await waitFor(() =>
      expect(screen.getByText(/Engineering → QA → Automation/)).toBeInTheDocument(),
    );
  });

  it('When creating a department / Then the parent selector lists every depth of the tree, not just root departments', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Department'));
    await waitFor(() => expect(screen.getByText(/Parent Department/i)).toBeInTheDocument());

    const select = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.querySelectorAll('option')).some((o) => o.textContent?.includes('Automation')),
    );
    expect(select).toBeTruthy();
    const optionTexts = Array.from(select!.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionTexts.some((t) => t?.includes('Engineering'))).toBe(true);
    expect(optionTexts.some((t) => t?.includes('QA'))).toBe(true);
    expect(optionTexts.some((t) => t?.includes('Automation'))).toBe(true);
  });

  it('When editing the QA department / Then the parent selector excludes QA itself and its descendant Automation (no self-parent / cycle)', async () => {
    renderPage();
    // Engineering (root) is expanded by default, so QA is already visible.
    await waitFor(() => expect(screen.getByText('QA')).toBeInTheDocument());
    const editButtons = screen.getAllByText('Edit');
    // Engineering renders first, QA is nested below it — QA's Edit is the 2nd.
    fireEvent.click(editButtons[1]);
    await waitFor(() => expect(screen.getByText(/Parent Department/i)).toBeInTheDocument());

    const select = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.querySelectorAll('option')).some((o) => o.textContent?.includes('Engineering')),
    );
    const optionTexts = Array.from(select!.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionTexts.some((t) => t?.includes('Engineering'))).toBe(true);
    expect(optionTexts.some((t) => t === 'QA')).toBe(false);
    expect(optionTexts.some((t) => t?.includes('Automation'))).toBe(false);
  });
});

/*
 * Regression: the Departments quota bar ("0 / Unlimited") never updated
 * after a create because the page loaded quotaData once and never called
 * useQuota's refresh() on mutation. Creating/updating a department must
 * bust the 60s quota cache immediately so the counter reflects the new
 * count right away instead of lagging behind the department list.
 */
describe('Given DepartmentsPage mutates a department', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockDept], total: 1 });
    mockApi.getTree.mockResolvedValue({ data: [mockDept] });
    mockRefreshQuota.mockClear();
  });

  it('When a department is created / Then the quota counter is refreshed', async () => {
    mockApi.create.mockResolvedValue({ id: 'd2', name: 'Sales' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Department'));
    await waitFor(() => expect(screen.getByText(/Code/i)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('ENG'), { target: { value: 'SAL' } });
    fireEvent.change(screen.getByPlaceholderText('Engineering'), { target: { value: 'Sales' } });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => expect(mockRefreshQuota).toHaveBeenCalled());
  });

  it('When a department is updated (e.g. deactivated) / Then the quota counter is refreshed', async () => {
    mockApi.update.mockResolvedValue({ ...mockDept, is_active: false });
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Edit')[0]);
    await waitFor(() => expect(screen.getByText(/Parent Department/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Update'));
    await waitFor(() => expect(mockRefreshQuota).toHaveBeenCalled());
  });
});

describe('Given DepartmentsPage create/update failure surfaces the backend error message', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockDept], total: 1 });
    mockApi.getTree.mockResolvedValue({ data: [mockDept] });
  });

  it('When create fails with a circular-reference error / Then the toast shows the backend message, not a generic one', async () => {
    const toastErrorSpy = vi.spyOn(toast, 'error');
    mockApi.create.mockRejectedValue(new Error('Cannot set department as parent - would create circular reference'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Department'));
    await waitFor(() => expect(screen.getByText(/Code/i)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('ENG'), { target: { value: 'XD' } });
    fireEvent.change(screen.getByPlaceholderText('Engineering'), { target: { value: 'X Dept' } });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() =>
      expect(toastErrorSpy).toHaveBeenCalledWith('Cannot set department as parent - would create circular reference'),
    );
  });
});
