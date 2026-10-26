import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// BDD specs for the read-only Employee Timesheets page.
// Time logging is consolidated into the Timesheets module — this page is a
// pure consumer: it must never expose create/edit/delete/submit/approve UI.

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn() },
}));

vi.mock('../services/timesheetApi', () => ({
  timesheetApi: { getEntries: vi.fn(), getUtilization: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

import EmployeeTimesheetsPage from './EmployeeTimesheetsPage';
import { peopleApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import { toast } from '@so360/design-system';

const mockPeopleApi = peopleApi as any;
const mockTimesheet = timesheetApi as any;

const renderPage = () => render(<MemoryRouter><EmployeeTimesheetsPage /></MemoryRouter>);

const entry = {
  id: 'e1', person_id: 'p1', user_id: 'u1', entry_date: '2026-06-09', hours: 7.5, description: 'API integration work',
  entity_type: 'project', entity_name: 'Website Redesign', project_id: 'proj-1', is_billable: true, calculated_cost: 375, status: 'approved',
};
const util = { people: [{ person_id: 'p1', user_id: 'u1', total_hours: 40, approved_hours: 32, submitted_hours: 8, billable_hours: 30, approved_cost: 1600 }] };

beforeEach(() => {
  vi.resetAllMocks();
  mockNavigate.mockReset();
  mockPeopleApi.getAll.mockResolvedValue({ data: [{ id: 'p1', full_name: 'Alice Doe' }] });
  mockTimesheet.getEntries.mockResolvedValue({ data: [entry], total: 1, limit: 100, offset: 0 });
  mockTimesheet.getUtilization.mockResolvedValue(util);
});

describe('Given the Employee Timesheets Comb list page', () => {
  it('When it loads / Then title, primary action and entry row are shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website Redesign')).toBeInTheDocument());
    expect(screen.getByTestId('list-page-template')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Employee Timesheets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log time in timesheets/i })).toBeInTheDocument();
  });

  it('When the request is pending / Then a loading status is shown', () => {
    mockTimesheet.getEntries.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();
  });

  it('When there are no entries / Then the empty state is shown', async () => {
    mockTimesheet.getEntries.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No timesheet entries')).toBeInTheDocument());
  });

  it('When the primary action is clicked / Then it navigates to My Timesheet', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /log time in timesheets/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/timesheet/my-timesheet');
  });

  it('When the person filter changes / Then entries are re-fetched for that person', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Alice Doe' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'p1' } });
    await waitFor(() => expect(mockTimesheet.getEntries).toHaveBeenLastCalledWith(expect.objectContaining({ person_id: 'p1' })));
  });

  it('When the end date precedes the start date / Then an alert and the invalid-range empty state show', async () => {
    renderPage();
    await screen.findByText('Website Redesign');
    fireEvent.change(screen.getByLabelText('Dates from'), { target: { value: '2026-06-20' } });
    fireEvent.change(screen.getByLabelText('Dates to'), { target: { value: '2026-06-10' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('End Date cannot be earlier than Start Date.'));
    expect(screen.getByText('Invalid date range')).toBeInTheDocument();
  });

  it('When loading fails / Then an error toast is shown', async () => {
    const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
    mockTimesheet.getEntries.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(err).toHaveBeenCalledWith('Failed to load employee timesheets'));
  });
});
