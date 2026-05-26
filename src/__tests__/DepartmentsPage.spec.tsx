import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/departmentsService', () => ({
  departmentsApi: {
    getTree: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  Department: {},
  CreateDepartmentPayload: {},
}));


vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

import DepartmentsPage from '../pages/DepartmentsPage';
import { departmentsApi } from '../services/departmentsService';

const mockApi = departmentsApi as any;

const renderPage = () =>
  render(<MemoryRouter><DepartmentsPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('DepartmentsPage', () => {
  describe('Given the API returns a department tree', () => {
    beforeEach(() => {
      mockApi.getTree.mockResolvedValue({
        data: [
          { id: 'd1', code: 'ENG', name: 'Engineering', is_active: true, employee_count: 10, head_person: { full_name: 'Lead Dev' }, children: [
            { id: 'd2', code: 'FE', name: 'Frontend', is_active: true, employee_count: 5, children: [] },
          ] },
        ],
      });
    });

    it('When the page loads / Then it renders the department hierarchy', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
      expect(screen.getByText('Frontend')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows department codes', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('ENG')).toBeInTheDocument());
    });

    it('When the page loads / Then it shows employee counts', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('10 employees')).toBeInTheDocument());
    });

    it('When the collapse button is clicked / Then child nodes are hidden', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Frontend')).toBeInTheDocument());
      const editButtons = screen.getAllByText('Edit');
      const deptCards = editButtons.map(b => b.closest('div[style]'));
      const engCard = deptCards.find(c => c?.textContent?.includes('Engineering'));
      const collapseBtn = engCard?.querySelector('button:not([disabled])');
      fireEvent.click(collapseBtn!);
      await waitFor(() => expect(screen.queryByText('Frontend')).not.toBeInTheDocument());
    });

    it('When the Create Department button is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Create Department'));
      await waitFor(() => expect(screen.getByPlaceholderText('ENG')).toBeInTheDocument());
    });
  });

  describe('Given no departments exist', () => {
    beforeEach(() => {
      mockApi.getTree.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No departments found')).toBeInTheDocument());
    });
  });
});
