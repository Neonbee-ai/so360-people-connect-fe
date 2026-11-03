/**
 * BDD specs - Departments: restore an archived department and assign a manager
 * through a single searchable picker (Pulse 27654625, items 3 and 4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

let allowed = true;

vi.mock('../services/departmentsService', () => ({
    departmentsApi: { getById: vi.fn(), getEmployees: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('../services/peopleService', () => ({ peopleApi: { getAll: vi.fn() } }));
vi.mock('../services/departmentScopeService', () => ({
    departmentScopeApi: { listForDepartment: vi.fn(), grant: vi.fn(), revoke: vi.fn() },
}));
vi.mock('../services/apiClient', () => ({
    apiContext: { getOrgId: () => 'org-1', getTenantId: () => 'tenant-1', getAccessToken: () => 'tok' },
}));
vi.mock('@so360/shell-context', () => ({
    useActivity: () => ({ recordActivity: async () => {} }),
    useShellBridge: () => ({
        permissionsLoaded: true,
        hasPermission: () => allowed,
        hasAnyPermission: () => allowed,
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
        currentTenant: { id: 'tenant-1' },
        currentOrg: { id: 'org-1' },
        user: { id: 'u1', email: 'a@b.com' },
        accessToken: 'tok',
    }),
}));

import { toast } from '@so360/design-system';
import DepartmentDetailPage from './DepartmentDetailPage';
import { departmentsApi } from '../services/departmentsService';
import { peopleApi } from '../services/peopleService';
import { departmentScopeApi } from '../services/departmentScopeService';

const deptApi = departmentsApi as any;
const peopleMock = peopleApi as any;
const scopeApi = departmentScopeApi as any;

const archived = {
    id: 'd1', org_id: 'org-1', tenant_id: 'tenant-1', name: 'Legacy Ops', code: 'OPS', is_active: false,
    employee_count: 0, created_at: '2024-01-15T10:00:00Z', updated_at: '2024-01-15T10:00:00Z',
};
const active = { ...archived, is_active: true };

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/departments/d1']}>
            <Routes><Route path="/departments/:id" element={<DepartmentDetailPage />} /></Routes>
        </MemoryRouter>
    );

beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    allowed = true;
    deptApi.getById.mockResolvedValue(archived);
    deptApi.getEmployees.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 1 });
    deptApi.update.mockResolvedValue(active);
    peopleMock.getAll.mockResolvedValue({
        data: [{ id: 'p1', full_name: 'Dhanooj Kumar', job_title: 'Engineer' }, { id: 'p2', full_name: 'Anusree KP' }],
        total: 2,
    });
    scopeApi.listForDepartment.mockResolvedValue([]);
});

describe('Given an archived department', () => {
    it('When the page loads / Then a Restore action is offered', async () => {
        renderPage();
        expect(await screen.findByRole('button', { name: /Restore/i })).toBeInTheDocument();
    });

    it('When the admin confirms Restore / Then the department is set active again', async () => {
        const success = vi.spyOn(toast, 'success');
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: /Restore/i }));
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }));
        await waitFor(() => expect(deptApi.update).toHaveBeenCalledWith('d1', { is_active: true }));
        await waitFor(() => expect(success).toHaveBeenCalledWith('Department restored successfully'));
    });

    it('When the admin cancels the Restore confirmation / Then nothing is saved', async () => {
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: /Restore/i }));
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Cancel/i }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(deptApi.update).not.toHaveBeenCalled();
    });

    it('When the restore request fails / Then the server message is shown', async () => {
        const err = vi.spyOn(toast, 'error');
        deptApi.update.mockRejectedValue(new Error('Department code is taken'));
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: /Restore/i }));
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }));
        await waitFor(() => expect(err).toHaveBeenCalledWith('Department code is taken'));
    });

    it('When the user lacks delete permission / Then Restore is not offered', async () => {
        allowed = false;
        renderPage();
        await screen.findByRole('heading', { name: 'Legacy Ops' });
        expect(screen.queryByRole('button', { name: /Restore/i })).toBeNull();
    });
});

describe('Given an active department', () => {
    it('When the page loads / Then Restore is not offered', async () => {
        deptApi.getById.mockResolvedValue(active);
        renderPage();
        await screen.findByRole('heading', { name: 'Legacy Ops' });
        expect(screen.queryByRole('button', { name: /Restore/i })).toBeNull();
    });

    it('When Assign Manager opens / Then one searchable picker replaces search field plus dropdown', async () => {
        deptApi.getById.mockResolvedValue(active);
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: /Assign Manager/i }));
        expect(await screen.findByLabelText('Select Manager *')).toBeInTheDocument();
        expect(screen.queryByLabelText('Search')).toBeNull();
        expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
        expect(screen.getByRole('dialog').querySelector('select')).toBeNull();
    });
});
