import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

import EmployeeTimesheetsPage from './EmployeeTimesheetsPage';
import { peopleApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';

const mockPeopleApi = peopleApi as any;
const mockTimesheet = timesheetApi as any;

const renderPage = () => render(<MemoryRouter><EmployeeTimesheetsPage /></MemoryRouter>);

const mockEntry = {
  id: 'e1',
  person_id: 'p1',
  user_id: 'u1',
  entry_date: '2026-06-09',
  hours: 7.5,
  description: 'API integration work',
  entity_type: 'project',
  entity_name: 'Website Redesign',
  project_id: 'proj-1',
  is_billable: true,
  calculated_cost: 375,
  status: 'approved',
};

const mockUtilization = {
  people: [
    { person_id: 'p1', user_id: 'u1', total_hours: 40, approved_hours: 32, submitted_hours: 8, billable_hours: 30, approved_cost: 1600 },
    { person_id: 'p2', user_id: 'u2', total_hours: 10, approved_hours: 4, submitted_hours: 2, billable_hours: 5, approved_cost: 200 },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockNavigate.mockReset();
  mockPeopleApi.getAll.mockResolvedValue({ data: [{ id: 'p1', full_name: 'Alice Doe' }, { id: 'p2', full_name: 'Bob Roe' }] });
  mockTimesheet.getEntries.mockResolvedValue({ data: [mockEntry], total: 1, limit: 100, offset: 0 });
  mockTimesheet.getUtilization.mockResolvedValue(mockUtilization);
});

describe('Given the Employee Timesheets page loads', () => {
  it('When rendered / Then the "Employee Timesheets" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Employee Timesheets')).toBeInTheDocument());
  });

  it('When rendered / Then entries are fetched from the Timesheet module with the default current-week range', async () => {
    renderPage();
    await waitFor(() => expect(mockTimesheet.getEntries).toHaveBeenCalled());
    const params = mockTimesheet.getEntries.mock.calls[0][0];
    expect(params.from_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.to_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.limit).toBe(100);
    expect(params.person_id).toBeUndefined();
  });

  it('When entries load / Then date, description, entity, hours and cost are rendered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website Redesign')).toBeInTheDocument());
    expect(screen.getByText('2026-06-09')).toBeInTheDocument();
    expect(screen.getByText('API integration work')).toBeInTheDocument();
    expect(screen.getByText('7.5h')).toBeInTheDocument();
    expect(screen.getByText('$375.00')).toBeInTheDocument();
  });

  it('When an entry is billable / Then the Billable marker is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Billable', { selector: 'span' })).toBeInTheDocument());
  });

  it('When entries load / Then the batch status badge is rendered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
  });

  it('When utilization loads / Then summary hours are aggregated across people for the range', async () => {
    renderPage();
    // totals across the two utilization rows: 50 total, 36 approved, 10 submitted, 35 billable
    await waitFor(() => expect(screen.getByText('50.0h')).toBeInTheDocument());
    expect(screen.getByText('36.0h')).toBeInTheDocument();
    expect(screen.getByText('10.0h')).toBeInTheDocument();
    expect(screen.getByText('35.0h')).toBeInTheDocument();
  });
});

describe('Given the person selector', () => {
  it('When the page loads / Then active people are loaded into the selector', async () => {
    renderPage();
    await waitFor(() => expect(mockPeopleApi.getAll).toHaveBeenCalledWith({ status: 'active', limit: 100 }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Alice Doe' })).toBeInTheDocument());
  });

  it('When a person is selected / Then entries are re-fetched filtered by that person', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Alice Doe' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Person filter'), { target: { value: 'p1' } });
    await waitFor(() =>
      expect(mockTimesheet.getEntries).toHaveBeenCalledWith(expect.objectContaining({ person_id: 'p1' }))
    );
  });

  it('When a person is selected / Then the utilization summary is scoped to that person', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Alice Doe' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Person filter'), { target: { value: 'p1' } });
    await waitFor(() =>
      expect(mockTimesheet.getUtilization).toHaveBeenCalledWith(expect.objectContaining({ person_ids: 'p1' }))
    );
  });
});

describe('Given the status and date-range filters', () => {
  it('When a status is selected / Then entries are re-fetched with that status', async () => {
    renderPage();
    await waitFor(() => expect(mockTimesheet.getEntries).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'submitted' } });
    await waitFor(() =>
      expect(mockTimesheet.getEntries).toHaveBeenCalledWith(expect.objectContaining({ status: 'submitted' }))
    );
  });

  it('When the from date changes / Then entries are re-fetched with the new range', async () => {
    renderPage();
    await waitFor(() => expect(mockTimesheet.getEntries).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-05-01' } });
    await waitFor(() =>
      expect(mockTimesheet.getEntries).toHaveBeenCalledWith(expect.objectContaining({ from_date: '2026-05-01' }))
    );
  });
});

describe('Given the page is strictly read-only', () => {
  it('When rendered / Then there is NO Log Time / create action', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website Redesign')).toBeInTheDocument());
    expect(screen.queryByText('Log Time')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^log time$/i })).not.toBeInTheDocument();
  });

  it('When rendered / Then there are NO submit/approve/reject/delete actions', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website Redesign')).toBeInTheDocument());
    expect(screen.queryByTitle('Submit for approval')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Approve')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Reject')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  it('When rendered / Then the read-only notice explains time is managed in Timesheets', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/created, submitted, and approved in the Timesheets module/i)).toBeInTheDocument()
    );
  });

  it('When "Log time in Timesheets" is clicked / Then it navigates to the Timesheet module', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /log time in timesheets/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /log time in timesheets/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/timesheet/my-timesheet');
  });
});

describe('Given the Timesheet module returns no entries', () => {
  beforeEach(() => {
    mockTimesheet.getEntries.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
    mockTimesheet.getUtilization.mockResolvedValue({ people: [] });
  });

  it('When the page loads / Then the empty state is shown without any create CTA', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No timesheet entries')).toBeInTheDocument());
    expect(screen.queryByText('Log Time')).not.toBeInTheDocument();
  });
});

describe('Given the Timesheet module is unavailable', () => {
  beforeEach(() => {
    mockTimesheet.getEntries.mockRejectedValue(new Error('boom'));
    mockTimesheet.getUtilization.mockRejectedValue(new Error('boom'));
  });

  it('When loading fails / Then an error toast is shown and the page does not crash', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load employee timesheets')).toBeInTheDocument());
    expect(screen.getByText('Employee Timesheets')).toBeInTheDocument();
  });
});

describe('Given non-billable entries', () => {
  beforeEach(() => {
    mockTimesheet.getEntries.mockResolvedValue({
      data: [{ ...mockEntry, id: 'e2', is_billable: false, status: 'draft', calculated_cost: null }],
      total: 1,
      limit: 100,
      offset: 0,
    });
  });

  it('When an entry is not billable / Then no Billable marker is rendered and cost falls back to zero', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website Redesign')).toBeInTheDocument());
    expect(screen.queryByText('Billable', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByText('Draft', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});
