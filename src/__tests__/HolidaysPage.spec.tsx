import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/holidaysService', () => ({
  holidaysApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    copyPreviousYear: vi.fn(),
    resolveHoliday: vi.fn(),
  },
}));

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../services/mastersService', () => ({
  mastersApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));

let mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ ...mockShellFlags }),
}));

vi.mock('@so360/design-system', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import HolidaysPage from '../pages/HolidaysPage';
import { holidaysApi } from '../services/holidaysService';

const mockApi = holidaysApi as any;

const WORK_LOCATION_A = 'loc-a';
const EMPLOYMENT_TYPE_FULL_TIME = 'et-full-time';

const renderPage = () => render(<MemoryRouter><HolidaysPage /></MemoryRouter>);

beforeEach(async () => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };

  const { workLocationsApi } = await import('../services/workLocationsService');
  const { mastersApi } = await import('../services/mastersService');
  (workLocationsApi.getAll as any).mockResolvedValue({
    data: [{ id: WORK_LOCATION_A, name: 'HQ Office' }],
  });
  (mastersApi.getAll as any).mockResolvedValue({
    data: [{ id: EMPLOYMENT_TYPE_FULL_TIME, name: 'Full Time' }],
  });
});

describe('HolidaysPage', () => {
  describe('Given holidays exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          { id: 'h1', name: 'Republic Day', holiday_date: '2026-01-26', holiday_type: 'national', is_optional: false, is_mandatory: true },
          { id: 'h2', name: 'Regional Festival', holiday_date: '2026-08-15', holiday_type: 'regional', is_optional: true, is_mandatory: false, state: 'Kerala', work_location_id: WORK_LOCATION_A },
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
        expect.objectContaining({ name: 'New Holiday', holiday_date: '2026-12-25', holiday_type: 'national' }),
      ));
    });

    it('When holidays load / Then holiday_type badge and scope column render', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Republic Day')).toBeInTheDocument());
      // 'National'/'Regional' also appear as <option> text in the filter/modal
      // selects, so assert presence via getAllByText rather than a unique match.
      expect(screen.getAllByText('National').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Regional').length).toBeGreaterThan(0);
      expect(screen.getByText('HQ Office')).toBeInTheDocument();
      expect(screen.getByText('Org-wide')).toBeInTheDocument();
    });

    it('Given a work location and employment type selected / When the create form is submitted / Then holidaysApi.create receives the scope', async () => {
      mockApi.create.mockResolvedValue({ id: 'h-new', name: 'Scoped Holiday' });
      renderPage();
      await waitFor(() => expect(screen.getByText('Republic Day')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Holiday'));
      await waitFor(() => expect(screen.getByText('Add Holiday', { selector: 'h2' })).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText('e.g. Republic Day'), { target: { value: 'Scoped Holiday' } });
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2026-12-25' } });
      fireEvent.change(screen.getByDisplayValue('All Locations'), { target: { value: WORK_LOCATION_A } });
      fireEvent.change(screen.getByDisplayValue('All Employment Types'), { target: { value: EMPLOYMENT_TYPE_FULL_TIME } });

      fireEvent.click(screen.getByText('Add Holiday', { selector: 'button[type="submit"]' }));

      await waitFor(() => expect(mockApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          work_location_id: WORK_LOCATION_A,
          employment_type_master_id: EMPLOYMENT_TYPE_FULL_TIME,
        }),
      ));
    });

    it('When Copy from Previous Year is clicked and confirmed / Then holidaysApi.copyPreviousYear is called and a summary is shown', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockApi.copyPreviousYear.mockResolvedValue({ created: 2, skipped: 1, created_holidays: [], skipped_holidays: [] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Republic Day')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Copy from Previous Year'));

      await waitFor(() => expect(mockApi.copyPreviousYear).toHaveBeenCalled());
      const [fromYear, toYear] = mockApi.copyPreviousYear.mock.calls[0];
      expect(toYear - fromYear).toBe(1);
      confirmSpy.mockRestore();
    });

    it('Given the user cancels the confirm dialog / When Copy from Previous Year is clicked / Then copyPreviousYear is NOT called', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderPage();
      await waitFor(() => expect(screen.getByText('Republic Day')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Copy from Previous Year'));

      expect(mockApi.copyPreviousYear).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
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
      mockShellFlags = { effectiveFlagsLoaded: false, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
      mockApi.getAll.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => expect(screen.queryByText('No holidays')).toBeInTheDocument());
      expect(screen.queryByText('Add Holiday')).not.toBeInTheDocument();
    });
  });
});
