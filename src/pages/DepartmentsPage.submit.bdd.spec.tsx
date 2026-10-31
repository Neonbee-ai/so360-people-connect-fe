import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
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
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

import DepartmentsPage from './DepartmentsPage';
import { departmentsApi } from '../services/departmentsService';

const mockApi = departmentsApi as any;

const existing = { id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, employee_count: 5, children: [] };

const openCreateModal = async () => {
  render(<MemoryRouter><DepartmentsPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /create department/i }));
  await waitFor(() => expect(screen.getByLabelText('Code *')).toBeInTheDocument());
};

const codeInput = () => screen.getByLabelText('Code *') as HTMLInputElement;
const nameInput = () => screen.getByLabelText('Name *') as HTMLInputElement;
const submitButton = () => screen.getByRole('button', { name: 'Create' });

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.getTree.mockResolvedValue({ data: [existing] });
  mockApi.getAll.mockResolvedValue({ data: [existing], total: 1 });
  mockApi.create.mockResolvedValue({ id: 'd2' });
});

// Pulse 29889378: Cancel never creates; a double submit creates exactly once.
describe('Given the Create Department form is filled in (Pulse 29889378)', () => {
  const fill = () => {
    fireEvent.change(codeInput(), { target: { value: 'QA' } });
    fireEvent.change(nameInput(), { target: { value: 'QA Department' } });
  };

  it('When Cancel is clicked / Then no department is created and the dialog closes', async () => {
    await openCreateModal();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByLabelText('Code *')).not.toBeInTheDocument());
    expect(mockApi.create).not.toHaveBeenCalled();
  });

  it('When the form is submitted twice before the first save returns / Then create is called once', async () => {
    let resolveCreate: (v: unknown) => void = () => {};
    mockApi.create.mockImplementation(() => new Promise((r) => { resolveCreate = r; }));
    await openCreateModal();
    fill();
    const form = submitButton().closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(mockApi.create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    resolveCreate({ id: 'd2' });
    await waitFor(() => expect(screen.queryByLabelText('Code *')).not.toBeInTheDocument());
    expect(mockApi.create).toHaveBeenCalledTimes(1);
  });
});
