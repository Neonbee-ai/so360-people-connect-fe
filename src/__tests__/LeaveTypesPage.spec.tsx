import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn() },
  LeaveType: {},
  CreateLeaveTypePayload: {},
}));

import LeaveTypesPage from '../pages/LeaveTypesPage';
import { leaveTypesApi } from '../services/leaveTypesService';

const mockApi = leaveTypesApi as any;

const renderPage = () => render(<MemoryRouter><LeaveTypesPage /></MemoryRouter>);

beforeEach(() => vi.resetAllMocks());

describe('LeaveTypesPage', () => {
  describe('Given leave types exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          {
            id: 'lt1', code: 'AL', name: 'Annual Leave', is_paid: true, requires_approval: true,
            requires_documentation: false, accrual_type: 'annual', max_days_per_year: 20,
            accrual_rate: 1.67, carry_forward_allowed: true, max_carry_forward_days: 5,
            notice_period_days: 3, color: '#10b981', is_active: true,
          },
        ],
      });
    });

    it('When the page loads / Then it renders the leave types table', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
      expect(screen.getByText('AL')).toBeInTheDocument();
    });

    it('When the Create Leave Type button is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Create Leave Type'));
      await waitFor(() => expect(screen.getByText('Basic Information')).toBeInTheDocument());
    });

    it('When an Edit button is clicked / Then the edit modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => expect(screen.getByText('Edit Leave Type')).toBeInTheDocument());
    });
  });

  describe('Given no leave types exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No leave types found')).toBeInTheDocument());
    });
  });
});
