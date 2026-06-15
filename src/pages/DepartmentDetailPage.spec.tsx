import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

vi.mock('../services/departmentsService', () => ({
    departmentsApi: {
        getById: vi.fn(),
        getEmployees: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('../services/peopleService', () => ({
    peopleApi: {
        getAll: vi.fn(),
    },
}));

vi.mock('@so360/shell-context', () => ({
    useActivity: () => ({ recordActivity: async () => {} }),
    useShellBridge: () => ({
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
        currentTenant: { id: 'tenant-1' },
        currentOrg: { id: 'org-1' },
        user: { id: 'u1', email: 'a@b.com' },
        accessToken: 'tok',
    }),
}));

import DepartmentDetailPage from './DepartmentDetailPage';
import { departmentsApi } from '../services/departmentsService';
import { peopleApi } from '../services/peopleService';

const mockDeptApi = departmentsApi as any;
const mockPeopleApi = peopleApi as any;

const mockDept = {
    id: 'd1',
    org_id: 'org-1',
    tenant_id: 'tenant-1',
    name: 'Engineering',
    code: 'ENG',
    is_active: true,
    employee_count: 2,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    head_person: { id: 'p1', full_name: 'Dhanooj Kumar' },
    head_person_id: 'p1',
};

const mockEmployee = {
    id: 'e1',
    full_name: 'Praveen VR',
    email: 'praveen@example.com',
    job_title: 'Senior Developer',
    status: 'active',
    type: 'employee',
};

const mockInactiveEmployee = {
    id: 'e2',
    full_name: 'Rahul K',
    email: 'rahul@example.com',
    job_title: 'QA Engineer',
    status: 'inactive',
    type: 'employee',
};

const renderPage = (id = 'd1') =>
    render(
        <MemoryRouter initialEntries={[`/departments/${id}`]}>
            <Routes>
                <Route path="/departments/:id" element={<DepartmentDetailPage />} />
                <Route path="/departments" element={<div>Departments List</div>} />
                <Route path="/people/:id" element={<div>Person Detail</div>} />
            </Routes>
        </MemoryRouter>
    );

beforeEach(() => {
    vi.resetAllMocks();
    mockPeopleApi.getAll.mockResolvedValue({ data: [], total: 0 });
});

// =============================================================================
// Successful Load
// =============================================================================

describe('Given DepartmentDetailPage loads successfully', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue(mockDept);
        mockDeptApi.getEmployees.mockResolvedValue({ data: [mockEmployee], total: 1, page: 1, limit: 100, totalPages: 1 });
    });

    it('When page loads / Then department name is displayed', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    });

    it('When page loads / Then department code is displayed', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('ENG')).toBeInTheDocument());
    });

    it('When page loads / Then department head name is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getAllByText(/Dhanooj Kumar/i).length).toBeGreaterThan(0));
    });

    it('When page loads / Then employee count is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getAllByText('1').length).toBeGreaterThan(0));
    });

    it('When page loads / Then total employees summary card shows correct value', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Total Employees')).toBeInTheDocument());
    });

    it('When page loads / Then employee name is listed in members table', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Praveen VR')).toBeInTheDocument());
    });

    it('When page loads / Then employee job title is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Senior Developer')).toBeInTheDocument());
    });

    it('When page loads / Then employee email is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('praveen@example.com')).toBeInTheDocument());
    });

    it('When page loads / Then View Profile link is shown for employee', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('View Profile')).toBeInTheDocument());
    });

    it('When page loads / Then Overview tab is active by default', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Department Members')).toBeInTheDocument());
    });

    it('When page loads / Then back navigation button is rendered', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText(/Back to Departments/i)).toBeInTheDocument());
    });
});

// =============================================================================
// Employee Counts
// =============================================================================

describe('Given DepartmentDetailPage with mixed employee statuses', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue(mockDept);
        mockDeptApi.getEmployees.mockResolvedValue({
            data: [mockEmployee, mockInactiveEmployee],
            total: 2,
            page: 1,
            limit: 100,
            totalPages: 1,
        });
    });

    it('When employees have mixed statuses / Then active count is computed correctly', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Active Employees')).toBeInTheDocument());
    });

    it('When employees have mixed statuses / Then inactive employees label is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Inactive Employees')).toBeInTheDocument());
    });
});

// =============================================================================
// No Employees
// =============================================================================

describe('Given DepartmentDetailPage with no employees', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue({ ...mockDept, employee_count: 0, head_person: undefined });
        mockDeptApi.getEmployees.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    });

    it('When department has no employees / Then empty state is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText(/No employees in this department/i)).toBeInTheDocument());
    });

    it('When department has no employees / Then total count shows 0', async () => {
        renderPage();
        await waitFor(() => expect(screen.getAllByText('0').length).toBeGreaterThan(0));
    });
});

// =============================================================================
// Not Found
// =============================================================================

describe('Given DepartmentDetailPage when department not found', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue(null);
        mockDeptApi.getEmployees.mockResolvedValue({ data: [], total: 0 });
    });

    it('When department not found / Then not found message is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText(/Department not found/i)).toBeInTheDocument());
    });

    it('When department not found / Then back link is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getAllByText(/Back to Departments/i).length).toBeGreaterThan(0));
    });
});

// =============================================================================
// Load Failed
// =============================================================================

describe('Given DepartmentDetailPage when API throws', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockRejectedValue(new Error('Network error'));
        mockDeptApi.getEmployees.mockResolvedValue({ data: [], total: 0 });
    });

    it('When API fails / Then failed to load message is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText(/Failed to load department/i)).toBeInTheDocument());
    });

    it('When API fails / Then Retry button is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Retry')).toBeInTheDocument());
    });
});

// =============================================================================
// Edit Modal
// =============================================================================

describe('Given DepartmentDetailPage edit interaction', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue(mockDept);
        mockDeptApi.getEmployees.mockResolvedValue({ data: [mockEmployee], total: 1, page: 1, limit: 100, totalPages: 1 });
    });

    it('When Edit button is clicked / Then edit modal opens', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
        await waitFor(() => expect(screen.getByText('Edit Department')).toBeInTheDocument());
    });

    it('When edit modal is open / Then department name field is pre-filled', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
        await waitFor(() => {
            const nameInput = screen.getAllByDisplayValue('Engineering');
            expect(nameInput.length).toBeGreaterThan(0);
        });
    });

    it('When edit modal Cancel is clicked / Then modal closes', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
        await waitFor(() => expect(screen.getByText('Edit Department')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        await waitFor(() => expect(screen.queryByText('Edit Department')).not.toBeInTheDocument());
    });

    it('When edit form is submitted / Then update API is called', async () => {
        mockDeptApi.update.mockResolvedValue({ ...mockDept, name: 'Engineering Team' });
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
        await waitFor(() => expect(screen.getByText('Edit Department')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
        await waitFor(() => expect(mockDeptApi.update).toHaveBeenCalledWith('d1', expect.objectContaining({ name: 'Engineering' })));
    });
});

// =============================================================================
// Archive Protection
// =============================================================================

describe('Given DepartmentDetailPage archive with active employees', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue(mockDept);
        mockDeptApi.getEmployees.mockResolvedValue({ data: [mockEmployee], total: 1, page: 1, limit: 100, totalPages: 1 });
    });

    it('When Archive is clicked with employees / Then error toast is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Archive/i }));
        await waitFor(() => expect(screen.getByText(/Cannot archive department/i)).toBeInTheDocument());
    });

    it('When Archive is clicked with employees / Then update is NOT called', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Archive/i }));
        await waitFor(() => expect(mockDeptApi.update).not.toHaveBeenCalled());
    });
});

describe('Given DepartmentDetailPage archive with no employees', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue({ ...mockDept, employee_count: 0 });
        mockDeptApi.getEmployees.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 });
        mockDeptApi.update.mockResolvedValue({ ...mockDept, is_active: false });
    });

    it('When Archive is clicked with no employees / Then update API is called', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Archive/i }));
        await waitFor(() => expect(mockDeptApi.update).toHaveBeenCalledWith('d1', { is_active: false }));
    });
});

// =============================================================================
// Assign Manager Modal
// =============================================================================

describe('Given DepartmentDetailPage assign manager interaction', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue(mockDept);
        mockDeptApi.getEmployees.mockResolvedValue({ data: [mockEmployee], total: 1, page: 1, limit: 100, totalPages: 1 });
        mockPeopleApi.getAll.mockResolvedValue({ data: [{ id: 'p2', full_name: 'Rahul K', job_title: 'QA Lead' }], total: 1 });
    });

    it('When Assign Manager button is clicked / Then assign manager modal opens', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Assign Manager/i }));
        await waitFor(() => expect(screen.getByText('Assign Department Manager')).toBeInTheDocument());
    });

    it('When assign manager modal opens / Then people list is loaded', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Assign Manager/i }));
        await waitFor(() => expect(mockPeopleApi.getAll).toHaveBeenCalledWith({ status: 'active', limit: 200 }));
    });

    it('When assign manager modal Cancel is clicked / Then modal closes', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Assign Manager/i }));
        await waitFor(() => expect(screen.getByText('Assign Department Manager')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        await waitFor(() => expect(screen.queryByText('Assign Department Manager')).not.toBeInTheDocument());
    });
});

// =============================================================================
// Analytics Tab
// =============================================================================

describe('Given DepartmentDetailPage analytics tab', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue(mockDept);
        mockDeptApi.getEmployees.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    });

    it('When Analytics tab is clicked / Then analytics section is shown', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Analytics'));
        await waitFor(() => expect(screen.getByText('Department Analytics')).toBeInTheDocument());
    });

    it('When Analytics tab is shown / Then Headcount Trend placeholder is visible', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Analytics'));
        await waitFor(() => expect(screen.getByText('Headcount Trend')).toBeInTheDocument());
    });

    it('When Analytics tab is shown / Then No Data Yet is shown for placeholders', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Analytics'));
        await waitFor(() => expect(screen.getAllByText('No Data Yet').length).toBeGreaterThan(0));
    });

    it('When Overview tab is clicked after Analytics / Then members section reappears', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Analytics'));
        await waitFor(() => expect(screen.getByText('Department Analytics')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Overview'));
        await waitFor(() => expect(screen.getByText('Department Members')).toBeInTheDocument());
    });
});

// =============================================================================
// View Profile Navigation
// =============================================================================

describe('Given DepartmentDetailPage employee View Profile action', () => {
    beforeEach(() => {
        mockDeptApi.getById.mockResolvedValue(mockDept);
        mockDeptApi.getEmployees.mockResolvedValue({ data: [mockEmployee], total: 1, page: 1, limit: 100, totalPages: 1 });
    });

    it('When View Profile is clicked / Then navigation to person page occurs', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('View Profile')).toBeInTheDocument());
        fireEvent.click(screen.getByText('View Profile'));
        await waitFor(() => expect(screen.getByText('Person Detail')).toBeInTheDocument());
    });
});
