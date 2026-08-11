import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/shiftsService', () => ({
  shiftsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

let mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ ...mockShellFlags }),
}));

vi.mock('@so360/design-system', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import ShiftsPage from '../pages/ShiftsPage';
import { shiftsApi } from '../services/shiftsService';

const mockApi = shiftsApi as any;

const renderPage = () => render(<MemoryRouter><ShiftsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
});

describe('ShiftsPage', () => {
  describe('Given shifts exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          { id: 's1', name: 'Morning', start_time: '09:00', end_time: '18:00', grace_period_minutes: 10, break_duration_minutes: 30, is_night_shift: false, is_active: true },
          { id: 's2', name: 'Night', start_time: '22:00', end_time: '06:00', grace_period_minutes: 15, break_duration_minutes: 45, is_night_shift: true, is_active: false },
        ],
      });
    });

    it('When the page loads / Then it renders the shifts table', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Morning')).toBeInTheDocument());
      expect(screen.getAllByText('Night').length).toBeGreaterThan(0);
      expect(screen.getByText('09:00 – 18:00')).toBeInTheDocument();
    });

    it('When Add Shift is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Morning')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Shift'));
      await waitFor(() => expect(screen.getByText('Add Shift', { selector: 'h2' })).toBeInTheDocument());
    });

    it('When Edit is clicked on a row / Then the edit modal opens with populated name', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Morning')).toBeInTheDocument());
      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);
      await waitFor(() => expect(screen.getByText('Edit Shift')).toBeInTheDocument());
      expect(screen.getByDisplayValue('Morning')).toBeInTheDocument();
    });

    it('When Delete is clicked on a row / Then shiftsApi.delete is called with that id', async () => {
      mockApi.delete.mockResolvedValue({ message: 'Shift deleted' });
      renderPage();
      await waitFor(() => expect(screen.getByText('Morning')).toBeInTheDocument());
      const deleteButtons = screen.getAllByTitle('Delete');
      fireEvent.click(deleteButtons[0]);
      await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('s1'));
    });

    it('When the toggle-active switch is clicked / Then shiftsApi.update is called with the flipped state', async () => {
      mockApi.update.mockResolvedValue({ id: 's1', is_active: false });
      renderPage();
      await waitFor(() => expect(screen.getByText('Morning')).toBeInTheDocument());
      const toggles = screen.getAllByTitle('Deactivate');
      fireEvent.click(toggles[0]);
      await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith('s1', { is_active: false }));
    });

    it('When the create form is submitted / Then shiftsApi.create is called with the form data', async () => {
      mockApi.create.mockResolvedValue({ id: 's-new', name: 'Evening' });
      renderPage();
      await waitFor(() => expect(screen.getByText('Morning')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Shift'));
      await waitFor(() => expect(screen.getByText('Add Shift', { selector: 'h2' })).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText('e.g. Morning Shift'), { target: { value: 'Evening' } });

      fireEvent.click(screen.getByText('Add Shift', { selector: 'button[type="submit"]' }));

      await waitFor(() => expect(mockApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Evening' }),
      ));
    });
  });

  describe('Given no shifts exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No shifts')).toBeInTheDocument());
    });
  });

  describe('Given effectiveFlagsLoaded is false', () => {
    it('When the page loads / Then Add Shift button is absent', async () => {
      mockShellFlags = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
      mockApi.getAll.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => expect(screen.queryByText('No shifts')).toBeInTheDocument());
      expect(screen.queryByText('Add Shift')).not.toBeInTheDocument();
    });
  });
});
