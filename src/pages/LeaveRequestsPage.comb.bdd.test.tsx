import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({ peopleApi: { getMe: vi.fn(), getAll: vi.fn() } }));
vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getAll: vi.fn(), getById: vi.fn(), create: vi.fn(), submit: vi.fn(), getBalances: vi.fn(), getEligibleApprovers: vi.fn() },
}));
vi.mock('../services/leaveTypesService', () => ({ leaveTypesApi: { getAll: vi.fn() } }));
vi.mock('../services/leaveConfigService', () => ({ leaveConfigApi: { getApplicable: vi.fn() } }));

const flags = { create: true };
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => flags.create, hasPermission: () => true, currentTenant: { id: 't' }, currentOrg: { id: 'o' } }),
}));
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({ formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '', businessToday: () => '2026-09-15' }),
}));

import LeaveRequestsPage from './LeaveRequestsPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { leaveConfigApi } from '../services/leaveConfigService';
import { peopleApi } from '../services/peopleService';
import { toast } from '@so360/design-system';

const api = leaveRequestsApi as any;
const row = {
  id: 'lr1', person: { id: 'p1', full_name: 'Alice Johnson' }, leave_type: { id: 'lt1', name: 'Annual Leave', color: '#10B981' },
  start_date: '2030-07-01', end_date: '2030-07-05', total_days: 5, status: 'pending', reason: 'Trip',
};
const renderPage = () => render(<MemoryRouter><LeaveRequestsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  flags.create = true;
  api.getAll.mockResolvedValue({ data: [row], total: 1 });
  api.getById.mockResolvedValue({ ...row, approvals: [] });
  api.getBalances.mockResolvedValue({ data: [] });
  api.getEligibleApprovers.mockResolvedValue({ data: [], total: 0, suggested_approver_id: null });
  api.create.mockResolvedValue({ id: 'new' });
  api.submit.mockResolvedValue({});
  (peopleApi as any).getMe.mockResolvedValue({ id: 'p1', full_name: 'Me' });
  (leaveConfigApi as any).getApplicable.mockResolvedValue({ leave_types: [{ id: 'lt1', name: 'Annual Leave' }] });
});

describe('LeaveRequestsPage (Comb)', () => {
  it('Given the page / When it loads / Then title, primary action and row show', async () => {
    renderPage();
    expect(await screen.findByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Leave Requests')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /request leave/i }).length).toBeGreaterThan(0);
  });

  it('Given no requests / When it loads / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    expect(await screen.findByText('No leave requests found')).toBeInTheDocument();
  });

  it('Given the list is pending / When it renders / Then a loading status shows first', () => {
    api.getAll.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('Given a status filter / When Approved is chosen / Then getAll is called with that status', async () => {
    renderPage();
    await screen.findByText('Alice Johnson');
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'approved' } });
    await waitFor(() => expect(api.getAll).toHaveBeenLastCalledWith({ status: 'approved' }));
  });

  it('Given a row / When View is clicked / Then the details modal opens and fetches the request', async () => {
    renderPage();
    await screen.findByText('Alice Johnson');
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(await screen.findByText('Leave Request Details')).toBeInTheDocument();
    await waitFor(() => expect(api.getById).toHaveBeenCalledWith('lr1'));
  });

  it('Given the create flag is off / When it loads / Then Request Leave is hidden', async () => {
    flags.create = false;
    renderPage();
    await screen.findByText('Alice Johnson');
    expect(screen.queryByRole('button', { name: /request leave/i })).not.toBeInTheDocument();
  });

  it('Given a valid form / When Submit Request is clicked / Then create then submit are called', async () => {
    renderPage();
    await screen.findByText('Alice Johnson');
    fireEvent.click(screen.getAllByRole('button', { name: /request leave/i })[0]);
    await screen.findByLabelText('Start Date *');
    await waitFor(() => expect(screen.getByText('Annual Leave', { selector: 'option' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Leave Type *'), { target: { value: 'lt1' } });
    fireEvent.change(screen.getByLabelText('Reason *'), { target: { value: 'Rest' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Request' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('new', []));
    expect(api.create).toHaveBeenCalled();
  });

  it('Given create fails / When Submit Request is clicked / Then an error toast shows', async () => {
    api.create.mockRejectedValue(new Error('boom'));
    const spy = vi.spyOn(toast, 'error');
    renderPage();
    await screen.findByText('Alice Johnson');
    fireEvent.click(screen.getAllByRole('button', { name: /request leave/i })[0]);
    await screen.findByLabelText('Start Date *');
    await waitFor(() => expect(screen.getByText('Annual Leave', { selector: 'option' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Leave Type *'), { target: { value: 'lt1' } });
    fireEvent.change(screen.getByLabelText('Reason *'), { target: { value: 'Rest' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Request' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('boom'));
  });
});
