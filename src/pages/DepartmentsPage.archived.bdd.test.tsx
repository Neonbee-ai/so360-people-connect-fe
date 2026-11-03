/**
 * BDD specs - Departments list: archived departments can be shown so they can
 * be found and restored (Pulse 27654625, item 4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { toast } from '@so360/design-system';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getAll: vi.fn(), getTree: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true,
    effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false,
    currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok',
  }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (i: any[]) => i, isLimited: () => false }),
}));

import DepartmentsPage from './DepartmentsPage';
import { departmentsApi } from '../services/departmentsService';

const api = departmentsApi as any;
const live = { id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, employee_count: 5, children: [] };
const old = { id: 'd2', name: 'Legacy Ops', code: 'OPS', is_active: false, employee_count: 0 };

const renderPage = () => render(
  <MemoryRouter initialEntries={['/departments']}>
    <Routes>
      <Route path="/departments" element={<DepartmentsPage />} />
      <Route path="/people/departments/:id" element={<div>Department Detail</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  api.getTree.mockResolvedValue({ data: [live] });
  api.getAll.mockResolvedValue({ data: [old], total: 1 });
});

describe('Given the departments list', () => {
  it('When loaded / Then archived departments are not requested or shown', async () => {
    renderPage();
    expect(await screen.findByText('Engineering')).toBeInTheDocument();
    expect(api.getAll).not.toHaveBeenCalled();
    expect(screen.queryByText('Legacy Ops')).toBeNull();
  });

  it('When Show archived is ticked / Then inactive departments are fetched and listed', async () => {
    renderPage();
    await screen.findByText('Engineering');
    fireEvent.click(screen.getByLabelText('Show archived'));
    expect(await screen.findByText('Legacy Ops')).toBeInTheDocument();
    expect(api.getAll).toHaveBeenCalledWith({ status: 'inactive', limit: 200 });
  });

  it('When an archived row is opened / Then the department detail (with Restore) is shown', async () => {
    renderPage();
    await screen.findByText('Engineering');
    fireEvent.click(screen.getByLabelText('Show archived'));
    fireEvent.click(await screen.findByRole('button', { name: /View \/ Restore/ }));
    expect(await screen.findByText('Department Detail')).toBeInTheDocument();
  });

  it('When there are no archived departments / Then an empty note is shown', async () => {
    api.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await screen.findByText('Engineering');
    fireEvent.click(screen.getByLabelText('Show archived'));
    expect(await screen.findByText('No archived departments.')).toBeInTheDocument();
  });

  it('When the archived request fails / Then an error toast is raised', async () => {
    const err = vi.spyOn(toast, 'error');
    api.getAll.mockRejectedValue(new Error('boom'));
    renderPage();
    await screen.findByText('Engineering');
    fireEvent.click(screen.getByLabelText('Show archived'));
    await waitFor(() => expect(err).toHaveBeenCalledWith('Failed to load archived departments'));
  });

  it('When Show archived is unticked again / Then the archived section is hidden', async () => {
    renderPage();
    await screen.findByText('Engineering');
    const box = screen.getByLabelText('Show archived');
    fireEvent.click(box);
    await screen.findByText('Legacy Ops');
    fireEvent.click(box);
    await waitFor(() => expect(screen.queryByText('Legacy Ops')).toBeNull());
  });
});
