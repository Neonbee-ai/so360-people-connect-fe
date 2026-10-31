import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();
let allowed = true;

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});
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

const dept = {
    id: 'd1', org_id: 'org-1', tenant_id: 'tenant-1', name: 'Engineering', code: 'ENG', is_active: true,
    employee_count: 1, created_at: '2024-01-15T10:00:00Z', updated_at: '2024-01-15T10:00:00Z',
    head_person: { id: 'p1', full_name: 'Dhanooj Kumar' }, head_person_id: 'p1',
};
const emp = { id: 'e1', full_name: 'Praveen VR', email: 'praveen@example.com', job_title: 'Senior Developer', status: 'active', type: 'employee' };

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/departments/d1']}>
            <Routes><Route path="/departments/:id" element={<DepartmentDetailPage />} /></Routes>
        </MemoryRouter>
    );

beforeEach(() => {
    vi.resetAllMocks();
    allowed = true;
    deptApi.getById.mockResolvedValue(dept);
    deptApi.getEmployees.mockResolvedValue({ data: [emp], total: 1, page: 1, limit: 100, totalPages: 1 });
    peopleMock.getAll.mockResolvedValue({ data: [], total: 0 });
    scopeApi.listForDepartment.mockResolvedValue([]);
});

describe('Given DepartmentDetailPage on Comb', () => {
    it('When loaded / Then title, tabs and actions are shown', async () => {
        renderPage();
        expect(await screen.findByRole('heading', { name: 'Engineering' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Access' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Assign Manager/i })).toBeInTheDocument();
    });

    it('When data is pending / Then loading state is shown', () => {
        deptApi.getById.mockReturnValue(new Promise(() => {}));
        renderPage();
        expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });

    it('When there are no employees / Then the empty state is shown', async () => {
        deptApi.getEmployees.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 });
        renderPage();
        expect(await screen.findByText(/No employees in this department/)).toBeInTheDocument();
    });

    it('When an employee row is clicked / Then it navigates to the person', async () => {
        renderPage();
        fireEvent.click(await screen.findByText('Praveen VR'));
        expect(mockNavigate).toHaveBeenCalledWith('/people/people/e1');
    });

    it('When the user lacks permissions / Then Edit, Assign Manager, Archive and Access are hidden', async () => {
        allowed = false;
        renderPage();
        await screen.findByRole('heading', { name: 'Engineering' });
        expect(screen.queryByRole('button', { name: /^Edit$/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /Assign Manager/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /Archive/i })).toBeNull();
        expect(screen.queryByRole('tab', { name: 'Access' })).toBeNull();
    });

    it('When archiving a department with employees / Then no delete call is made', async () => {
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: /Archive/i }));
        await waitFor(() => expect(deptApi.delete).not.toHaveBeenCalled());
    });

    it('When the load fails / Then a retry empty state is shown', async () => {
        deptApi.getById.mockRejectedValue(new Error('boom'));
        renderPage();
        expect(await screen.findByText(/Failed to load department/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(toast).toBeDefined();
    });
});

describe('Given a department nobody has scoped access to (Pulse 27654625)', () => {
    it('When the Access tab opens / Then exactly one Grant Access button is offered', async () => {
        renderPage();
        expect(await screen.findByRole('heading', { name: 'Engineering' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'Access' }));
        expect(await screen.findByText('No one has scoped access to this department')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /Grant Access/ })).toHaveLength(1);
    });
});
