/**
 * BDD specs - DepartmentsPage on Comb (ListPageTemplate + Card tree + Modal form).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { toast } from '@so360/design-system';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const flags = { edit: true };
vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getAll: vi.fn(), getTree: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    permissionsLoaded: true, hasPermission: () => flags.edit, hasAnyPermission: () => flags.edit,
    effectiveFlagsLoaded: true, isFeatureEnabled: () => flags.edit, isFeatureHidden: () => false,
    currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok',
  }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (i: any[]) => i, isLimited: () => false }),
}));

import DepartmentsPage from './DepartmentsPage';
import { departmentsApi } from '../services/departmentsService';

const api = departmentsApi as any;
const dept = { id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, employee_count: 5, children: [] };

const renderPage = () => render(
  <MemoryRouter initialEntries={['/departments']}>
    <Routes>
      <Route path="/departments" element={<DepartmentsPage />} />
      <Route path="/departments/:id" element={<div>Department Detail</div>} />
    </Routes>
  </MemoryRouter>,
);

let errSpy: any;
beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  flags.edit = true;
  errSpy = vi.spyOn(toast, 'error');
  api.getAll.mockResolvedValue({ data: [dept], total: 1 });
  api.getTree.mockResolvedValue({ data: [dept] });
  api.create.mockResolvedValue({ data: dept });
  api.update.mockResolvedValue({ data: dept });
});

describe('DepartmentsPage (Comb)', () => {
  it('Given departments / When loaded / Then title, row and primary action show', async () => {
    renderPage();
    expect(await screen.findByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Departments')).toBeInTheDocument();
    expect(screen.getByText('ENG')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Department/ })).toBeInTheDocument();
  });

  it('Given no departments / When loaded / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue({ data: [], total: 0 });
    api.getTree.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText(/No departments found/i)).toBeInTheDocument();
  });

  it('Given a row / When its info area is clicked / Then the detail route opens', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Engineering'));
    expect(await screen.findByText('Department Detail')).toBeInTheDocument();
  });

  it('Given edit permission is off / When loaded / Then Edit buttons are hidden', async () => {
    flags.edit = false;
    renderPage();
    await screen.findByText('Engineering');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('Given the create form / When submitted / Then create receives code and name', async () => {
    renderPage();
    await screen.findByText('Engineering');
    fireEvent.click(screen.getByRole('button', { name: /Create Department/ }));
    fireEvent.change(await screen.findByLabelText('Code *'), { target: { value: 'QA' } });
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Quality' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'QA', name: 'Quality' })));
  });

  it('Given the list API fails / When loaded / Then an error toast is raised', async () => {
    api.getAll.mockRejectedValue(new Error('Server error'));
    api.getTree.mockRejectedValue(new Error('Server error'));
    renderPage();
    await waitFor(() => expect(errSpy).toHaveBeenCalled());
  });
});
