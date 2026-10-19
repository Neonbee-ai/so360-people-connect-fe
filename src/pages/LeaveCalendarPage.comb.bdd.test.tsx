import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/leaveRequestsService', () => ({ leaveRequestsApi: { getAll: vi.fn() }, LeaveRequest: {} }));
vi.mock('../services/departmentsService', () => ({ departmentsApi: { getAll: vi.fn() }, Department: {} }));
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({ formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '', locale: 'en-US' }),
}));

import LeaveCalendarPage from './LeaveCalendarPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { departmentsApi } from '../services/departmentsService';

const leaves = leaveRequestsApi as any;
const depts = departmentsApi as any;
const renderPage = () => render(<MemoryRouter><LeaveCalendarPage /></MemoryRouter>);

const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`;
const leave = {
  id: 'l1', status: 'approved', start_date: iso, end_date: iso, total_days: 1, reason: 'Trip',
  person: { id: 'p1', full_name: 'Dhanooj Kumar', department_id: 'd1' },
  leave_type: { name: 'Annual Leave' },
};

beforeEach(() => {
  vi.resetAllMocks();
  depts.getAll.mockResolvedValue({ data: [{ id: 'd1', name: 'Engineering' }] });
  leaves.getAll.mockResolvedValue({ data: [], total: 0 });
});

describe('LeaveCalendarPage (Comb)', () => {
  it('Given the page / When rendered / Then title, weekday headers and legend show', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Leave Calendar' })).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('Given no leave / When loaded / Then the empty notice names the month', async () => {
    renderPage();
    expect(await screen.findByText(/No leave records in/)).toBeInTheDocument();
  });

  it('Given the month / When fetched / Then approved and pending are requested', async () => {
    renderPage();
    await waitFor(() => expect(leaves.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', limit: 200 })));
    expect(leaves.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', limit: 200 }));
  });

  it('Given a leave chip / When clicked / Then the details modal opens', async () => {
    leaves.getAll.mockResolvedValue({ data: [leave], total: 1 });
    renderPage();
    const chips = await screen.findAllByText('Dhanooj');
    fireEvent.click(chips[0]);
    expect(await screen.findByText('Leave Details')).toBeInTheDocument();
    expect(screen.getByText('Trip')).toBeInTheDocument();
  });

  it('Given the API fails / When Retry is clicked / Then the data is fetched again', async () => {
    leaves.getAll.mockRejectedValue(new Error('x'));
    renderPage();
    const retry = await screen.findByRole('button', { name: /retry/i });
    leaves.getAll.mockResolvedValue({ data: [], total: 0 });
    fireEvent.click(retry);
    await waitFor(() => expect(leaves.getAll).toHaveBeenCalledTimes(4));
  });
});
