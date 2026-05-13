import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getAll: vi.fn() },
  LeaveRequest: {},
}));
vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getAll: vi.fn() },
  Department: {},
}));

import LeaveCalendarPage from '../pages/LeaveCalendarPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { departmentsApi } from '../services/departmentsService';

const mockLeaveApi = leaveRequestsApi as any;
const mockDeptApi = departmentsApi as any;

const renderPage = () =>
  render(<MemoryRouter><LeaveCalendarPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockDeptApi.getAll.mockResolvedValue({ data: [{ id: 'd1', name: 'Engineering' }] });
  mockLeaveApi.getAll.mockResolvedValue({ data: [] });
});

describe('LeaveCalendarPage', () => {
  describe('Given the calendar page is rendered', () => {
    it('When the page loads / Then it shows the calendar header', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Leave Calendar')).toBeInTheDocument());
    });

    it('When the page loads / Then it shows day-of-week headers', async () => {
      renderPage();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
    });

    it('When the page loads / Then it shows the legend', async () => {
      renderPage();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('When the Today button is clicked / Then the current date is restored', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Today')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Today'));
    });
  });

  describe('Given month navigation', () => {
    it('When the next month button is clicked / Then the calendar advances', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Leave Calendar')).toBeInTheDocument());
      const nextBtn = screen.getByTestId('icon-ChevronRight').closest('button');
      if (nextBtn) {
        fireEvent.click(nextBtn);
        await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalledTimes(4));
      }
    });

    it('When the prev month button is clicked / Then the calendar goes back', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Leave Calendar')).toBeInTheDocument());
      const prevBtn = screen.getByTestId('icon-ChevronLeft').closest('button');
      if (prevBtn) {
        fireEvent.click(prevBtn);
        await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalledTimes(4));
      }
    });

    it('When department filter is changed / Then leaves are reloaded', async () => {
      renderPage();
      await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalled());
      const deptSelect = screen.getByDisplayValue('All Departments');
      fireEvent.change(deptSelect, { target: { value: 'd1' } });
      await waitFor(() => expect(mockLeaveApi.getAll).toHaveBeenCalledTimes(2));
    });
  });

  describe('Given leaves exist for the month', () => {
    beforeEach(() => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
      mockLeaveApi.getAll.mockResolvedValue({
        data: [
          { id: 'l1', status: 'approved', start_date: dateStr, end_date: dateStr, person: { full_name: 'Alice Jones' }, leave_type: { name: 'Annual' }, total_days: 1 },
        ],
      });
    });

    it('When the page loads / Then leave entries appear on the calendar', async () => {
      renderPage();
      await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThan(0));
    });
  });
});
