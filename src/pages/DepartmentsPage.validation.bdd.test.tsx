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
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
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

describe('Given the Create Department form', () => {
  it('When a code of random numbers and special characters is entered / Then an inline error is shown and submit is blocked', async () => {
    await openCreateModal();

    fireEvent.change(codeInput(), { target: { value: '878965%(%%(&(%P0' } });
    fireEvent.change(nameInput(), { target: { value: 'QA Department' } });

    expect(await screen.findByText(/valid department code/i)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();

    fireEvent.click(submitButton());
    expect(mockApi.create).not.toHaveBeenCalled();
  });

  it('When a name of random numbers and special characters is entered / Then an inline error is shown and submit is blocked', async () => {
    await openCreateModal();

    fireEvent.change(codeInput(), { target: { value: 'QA' } });
    fireEvent.change(nameInput(), { target: { value: '5464687987&(&%&*^(' } });

    expect(await screen.findByText(/valid department name/i)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('When a duplicate code is entered / Then a duplicate message is shown before any API call', async () => {
    await openCreateModal();

    fireEvent.change(codeInput(), { target: { value: 'eng' } });
    fireEvent.change(nameInput(), { target: { value: 'Engineering Two' } });

    expect(await screen.findByText('This department code already exists.')).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(mockApi.create).not.toHaveBeenCalled();
  });

  it('When valid values "QA" and "QA Department" are entered / Then the department is created', async () => {
    await openCreateModal();

    fireEvent.change(codeInput(), { target: { value: 'QA' } });
    fireEvent.change(nameInput(), { target: { value: 'QA Department' } });

    expect(submitButton()).not.toBeDisabled();
    fireEvent.click(submitButton());

    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
    expect(mockApi.create.mock.calls[0][0]).toMatchObject({ code: 'QA', name: 'QA Department' });
  });

  it('When "Engineering & Development" is entered as the name / Then it is accepted', async () => {
    await openCreateModal();

    fireEvent.change(codeInput(), { target: { value: 'ENGDEV' } });
    fireEvent.change(nameInput(), { target: { value: 'Engineering & Development' } });

    expect(submitButton()).not.toBeDisabled();
  });

  it('When the form is opened / Then submit is disabled until both mandatory fields are valid', async () => {
    await openCreateModal();
    expect(submitButton()).toBeDisabled();
  });

  it('When an invalid code is corrected / Then the inline error clears', async () => {
    await openCreateModal();

    fireEvent.change(codeInput(), { target: { value: '###' } });
    expect(await screen.findByText(/valid department code/i)).toBeInTheDocument();

    fireEvent.change(codeInput(), { target: { value: 'QA' } });
    await waitFor(() => expect(screen.queryByText(/valid department code/i)).not.toBeInTheDocument());
  });

  it('When the parent selector is rendered / Then "None (Top Level)" remains available', async () => {
    await openCreateModal();
    expect(screen.getByText('None (Top Level)')).toBeInTheDocument();
  });
});
