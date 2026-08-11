import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/holidaysService', () => ({
  holidaysApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

let mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ ...mockShellFlags }),
}));

vi.mock('@so360/design-system', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import HolidaysPage from '../pages/HolidaysPage';
import { holidaysApi } from '../services/holidaysService';

const mockApi = holidaysApi as any;

const renderPage = () => render(<MemoryRouter><HolidaysPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
});

describe('HolidaysPage', () => {
  describe('Given holidays exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          { id: 'h1', name: 'Republic Day', holiday_date: '2026-01-26', is_optional: false, is_mandatory: true },
          { id: 'h2', name: 'Regional Festival', holiday_date: '2026-08-15', is_optional: true, is_mandatory: false, state: 'Kerala' },
        ],
      });
    });

    it('When the page loads / Then it renders holidays grouped by month', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Republic Day')).toBeInTheDocument());
      expect(screen.getByText('Regional Festival')).toBeInTheDocument();
      expect(screen.getByText('January')).toBeInTheDocument();
      expect(screen.getByText('August')).toBeInTheDocument();
    });

    it('When Add Holiday is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Republic Day')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Holiday'));
      await waitFor(() => expect(screen.getByText('Add Holiday', { selector: 'h2' })).toBeInTheDocument());
    });

    it('When Edit is clicked on a row / Then the edit modal opens with populated name', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Republic Day')).toBeInTheDocument());
      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);
      await waitFor(() => expect(screen.getByText('Edit Holiday')).toBeInTheDocument());
      expect(screen.getByDisplayValue('Republic Day')).toBeInTheDocument();
    });

    it('When Delete is clicked on a row / Then holidaysApi.delete is called with that id', async () => {
      mockApi.delete.mockResolvedValue({ message: 'Holiday deleted' });
      renderPage();
      await waitFor(() => expect(screen.getByText('Republic Day')).toBeInTheDocument());
      const deleteButtons = screen.getAllByTitle('Delete');
      fireEvent.click(deleteButtons[0]);
      await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('h1'));
    });

    it('When the create form is submitted / Then holidaysApi.create is called with the form data', async () => {
      mockApi.create.mockResolvedValue({ id: 'h-new', name: 'New Holiday' });
      renderPage();
      await waitFor(() => expect(screen.getByText('Republic Day')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Holiday'));
      await waitFor(() => expect(screen.getByText('Add Holiday', { selector: 'h2' })).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText('e.g. Republic Day'), { target: { value: 'New Holiday' } });
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2026-12-25' } });

      fireEvent.click(screen.getByText('Add Holiday', { selector: 'button[type="submit"]' }));

      await waitFor(() => expect(mockApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Holiday', holiday_date: '2026-12-25' }),
      ));
    });
  });

  describe('Given no holidays exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No holidays')).toBeInTheDocument());
    });
  });

  describe('Given effectiveFlagsLoaded is false', () => {
    it('When the page loads / Then Add Holiday button is absent', async () => {
      mockShellFlags = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
      mockApi.getAll.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => expect(screen.queryByText('No holidays')).toBeInTheDocument());
      expect(screen.queryByText('Add Holiday')).not.toBeInTheDocument();
    });
  });
});
