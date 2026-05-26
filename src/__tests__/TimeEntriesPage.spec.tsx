import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/peopleService', () => ({
  timeEntriesApi: { getAll: vi.fn(), create: vi.fn(), submit: vi.fn(), approve: vi.fn(), reject: vi.fn(), delete: vi.fn() },
  peopleApi: { getAll: vi.fn() },
  allocationsApi: { getAll: vi.fn() },
}));


vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { currency: 'USD', timezone: 'UTC' } }),}));

import TimeEntriesPage from '../pages/TimeEntriesPage';
import { timeEntriesApi, peopleApi, allocationsApi } from '../services/peopleService';

const mockApi = timeEntriesApi as any;
const mockPeople = peopleApi as any;
const mockAlloc = allocationsApi as any;

const renderPage = () => render(<MemoryRouter><TimeEntriesPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockPeople.getAll.mockResolvedValue({ data: [{ id: 'p1', full_name: 'Alice' }] });
  mockAlloc.getAll.mockResolvedValue({ data: [] });
});

describe('TimeEntriesPage', () => {
  describe('Given time entries exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          {
            id: 'te1', person: { full_name: 'Alice' }, entity_type: 'project',
            entity_name: 'Website', entity_id: 'p1', work_date: '2025-06-01',
            hours: 4, total_cost: 200, status: 'draft', description: 'Frontend work',
          },
          {
            id: 'te2', person: { full_name: 'Bob' }, entity_type: 'task',
            entity_name: 'API', entity_id: 't1', work_date: '2025-06-01',
            hours: 6, total_cost: 300, status: 'submitted', description: 'Backend',
          },
        ],
      });
    });

    it('When the page loads / Then it renders entries', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows summary totals', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('10.0h total')).toBeInTheDocument());
    });

    it('When the page loads / Then it shows pending count', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('1 pending')).toBeInTheDocument());
    });

    it('When Log Time is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Log Time'));
      await waitFor(() => expect(screen.getByText('Person *')).toBeInTheDocument());
    });
  });

  describe('Given time entry actions are performed', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          {
            id: 'te1', person: { full_name: 'Alice' }, entity_type: 'project',
            entity_name: 'Website', entity_id: 'p1', work_date: '2025-06-01',
            hours: 4, total_cost: 200, status: 'draft', description: 'Frontend work',
          },
          {
            id: 'te2', person: { full_name: 'Bob' }, entity_type: 'task',
            entity_name: 'API', entity_id: 't1', work_date: '2025-06-01',
            hours: 6, total_cost: 300, status: 'submitted', description: 'Backend',
          },
          {
            id: 'te3', person: { full_name: 'Charlie' }, entity_type: 'project',
            entity_name: 'Mobile', entity_id: 'p2', work_date: '2025-06-02',
            hours: 3, total_cost: 150, status: 'approved', description: 'Testing',
          },
        ],
      });
    });

    it('When status filter is changed / Then entries are reloaded', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'draft' } });
      await waitFor(() => expect(mockApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' })));
    });

    it('When date filter is set / Then entries are reloaded with date', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      const dateInput = document.querySelector('input[type="date"]');
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-06-01' } });
      await waitFor(() => expect(mockApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ from_date: '2025-06-01' })));
    });

    it('When select-all checkbox is toggled / Then all checkboxes become checked', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0]).toBeChecked();
    });

    it('When total cost is shown / Then it shows formatted currency', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('$650')).toBeInTheDocument());
    });
  });

  describe('Given no time entries exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No time entries')).toBeInTheDocument());
    });
  });
});
