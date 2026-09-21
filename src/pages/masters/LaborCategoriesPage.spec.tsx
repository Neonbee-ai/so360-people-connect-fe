/**
 * BDD specs — LaborCategoriesPage.
 *
 * Until this screen existed there was no way to create a labor category anywhere
 * in the product, while the Log Time precheck was telling users one was missing.
 * The behaviours worth locking in are the ones that make an unpriced category
 * legible (0 is legal but means unconfigured) and the ones that pass the
 * backend's guard messages through instead of flattening them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true }),
}));

vi.mock('../../services/laborCategoriesService', () => ({
  laborCategoriesApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import LaborCategoriesPage from './LaborCategoriesPage';
import { laborCategoriesApi } from '../../services/laborCategoriesService';
import { toast } from '@so360/design-system';

const mockApi = laborCategoriesApi as any;

function makeCategory(overrides: Record<string, any> = {}) {
  return {
    id: 'cat-1',
    org_id: 'org-1',
    tenant_id: 'tenant-1',
    name: 'Senior Engineer',
    code: 'SENR_ENG',
    base_hourly_rate: 75,
    overtime_multiplier: 1.5,
    is_active: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.getAll.mockResolvedValue([]);
  mockApi.create.mockResolvedValue(makeCategory());
  mockApi.update.mockResolvedValue(makeCategory());
  mockApi.remove.mockResolvedValue({ success: true, id: 'cat-1' });
});

describe('LaborCategoriesPage', () => {
  describe('Given the org has no labor categories', () => {
    // This is the exact state that blocked time logging with nowhere to go.
    it('When the page loads / Then an empty state offers to create the first one', async () => {
      render(<LaborCategoriesPage />);
      expect(await screen.findByText('No labor categories')).toBeInTheDocument();
      expect(screen.getAllByText('Add Labor Category').length).toBeGreaterThan(0);
    });
  });

  describe('Given categories exist', () => {
    it('When loaded / Then name, code and rate are listed', async () => {
      mockApi.getAll.mockResolvedValue([makeCategory()]);
      render(<LaborCategoriesPage />);

      expect(await screen.findByText('Senior Engineer')).toBeInTheDocument();
      expect(screen.getByText('SENR_ENG')).toBeInTheDocument();
      expect(screen.getByText('75.00')).toBeInTheDocument();
    });

    // A 0 rate is legal but cannot cost anyone — rendering "0.00" would look
    // configured. Say "Not set" and warn above the table.
    it('When a category has no rate / Then it reads "Not set" rather than 0.00', async () => {
      mockApi.getAll.mockResolvedValue([makeCategory({ base_hourly_rate: 0 })]);
      render(<LaborCategoriesPage />);

      expect(await screen.findByText('Not set')).toBeInTheDocument();
      expect(screen.queryByText('0.00')).not.toBeInTheDocument();
    });

    it('When active categories lack rates / Then a warning explains they cannot cost time', async () => {
      mockApi.getAll.mockResolvedValue([
        makeCategory({ id: 'a', base_hourly_rate: 0 }),
        makeCategory({ id: 'b', code: 'B', base_hourly_rate: 0 }),
      ]);
      render(<LaborCategoriesPage />);

      const alert = await screen.findByRole('status');
      expect(alert).toHaveTextContent('2 active categories have no hourly rate');
    });

    it('When only INACTIVE categories lack rates / Then no warning is shown, since they cost nothing anyway', async () => {
      mockApi.getAll.mockResolvedValue([
        makeCategory({ base_hourly_rate: 0, is_active: false }),
      ]);
      render(<LaborCategoriesPage />);

      await screen.findByText('Senior Engineer');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('When every category is priced / Then no warning is shown', async () => {
      mockApi.getAll.mockResolvedValue([makeCategory()]);
      render(<LaborCategoriesPage />);

      await screen.findByText('Senior Engineer');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Given the create form', () => {
    it('When submitted / Then the category is created and the list reloads', async () => {
      render(<LaborCategoriesPage />);
      fireEvent.click((await screen.findAllByText('Add Labor Category'))[0]);

      fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'QA Engineer' } });
      fireEvent.change(screen.getByLabelText('Code *'), { target: { value: 'QA_ENG' } });
      fireEvent.change(screen.getByLabelText('Hourly Rate'), { target: { value: '60' } });
      fireEvent.click(screen.getByText('Create'));

      await waitFor(() =>
        expect(mockApi.create).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'QA Engineer', code: 'QA_ENG', base_hourly_rate: 60 }),
        ),
      );
      expect(mockApi.getAll).toHaveBeenCalledTimes(2);
    });

    it('When the rate is left at 0 / Then the form warns it will not price time', async () => {
      render(<LaborCategoriesPage />);
      fireEvent.click((await screen.findAllByText('Add Labor Category'))[0]);

      expect(
        screen.getByText(/Leave at 0 only if this category should not price time/),
      ).toBeInTheDocument();
    });

    it('When required fields are blank / Then nothing is submitted', async () => {
      render(<LaborCategoriesPage />);
      fireEvent.click((await screen.findAllByText('Add Labor Category'))[0]);
      fireEvent.click(screen.getByText('Create'));

      await waitFor(() => expect(mockApi.create).not.toHaveBeenCalled());
    });

    // The duplicate-code guard names the offending code; a generic toast would
    // throw that away and leave the user guessing.
    it('When the backend rejects a duplicate code / Then its message is surfaced verbatim', async () => {
      const toastErrorSpy = vi.spyOn(toast, 'error');
      mockApi.create.mockRejectedValue(
        new Error("Labor category with code 'QA_ENG' already exists"),
      );

      render(<LaborCategoriesPage />);
      fireEvent.click((await screen.findAllByText('Add Labor Category'))[0]);
      fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'QA' } });
      fireEvent.change(screen.getByLabelText('Code *'), { target: { value: 'QA_ENG' } });
      fireEvent.click(screen.getByText('Create'));

      await waitFor(() =>
        expect(toastErrorSpy).toHaveBeenCalledWith(
          "Labor category with code 'QA_ENG' already exists",
        ),
      );
    });
  });

  describe('Given the edit form', () => {
    it('When opened / Then it is prefilled and the code is locked', async () => {
      mockApi.getAll.mockResolvedValue([makeCategory()]);
      render(<LaborCategoriesPage />);
      fireEvent.click(await screen.findByLabelText('Edit Senior Engineer'));

      expect((screen.getByLabelText('Name *') as HTMLInputElement).value).toBe('Senior Engineer');
      expect(screen.getByLabelText('Code *')).toBeDisabled();
      expect(screen.getByText('Code cannot be changed after creation.')).toBeInTheDocument();
    });

    // code is the org-unique key; the backend's update DTO omits it, so sending
    // it would simply be stripped — better not to imply it is editable.
    it('When saved / Then code is not part of the update payload', async () => {
      mockApi.getAll.mockResolvedValue([makeCategory()]);
      render(<LaborCategoriesPage />);
      fireEvent.click(await screen.findByLabelText('Edit Senior Engineer'));

      fireEvent.change(screen.getByLabelText('Hourly Rate'), { target: { value: '90' } });
      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => expect(mockApi.update).toHaveBeenCalled());
      const payload = mockApi.update.mock.calls[0][1];
      expect(payload.base_hourly_rate).toBe(90);
      expect(payload).not.toHaveProperty('code');
    });
  });

  describe('Given the active toggle', () => {
    it('When toggled / Then only is_active is sent', async () => {
      mockApi.getAll.mockResolvedValue([makeCategory()]);
      render(<LaborCategoriesPage />);
      fireEvent.click(await screen.findByLabelText('Deactivate'));

      await waitFor(() =>
        expect(mockApi.update).toHaveBeenCalledWith('cat-1', { is_active: false }),
      );
    });
  });

  describe('Given delete', () => {
    it('When it succeeds / Then the list reloads', async () => {
      mockApi.getAll.mockResolvedValue([makeCategory()]);
      render(<LaborCategoriesPage />);
      fireEvent.click(await screen.findByLabelText('Delete Senior Engineer'));

      await waitFor(() => expect(mockApi.remove).toHaveBeenCalledWith('cat-1'));
    });

    // The backend refuses when entries or employee defaults reference it and says
    // how many — that detail is the whole value of the message.
    it('When the category is in use / Then the backend guard message reaches the user', async () => {
      const toastErrorSpy = vi.spyOn(toast, 'error');
      mockApi.getAll.mockResolvedValue([makeCategory()]);
      mockApi.remove.mockRejectedValue(
        new Error('12 time entries reference it. Deactivate it instead.'),
      );

      render(<LaborCategoriesPage />);
      fireEvent.click(await screen.findByLabelText('Delete Senior Engineer'));

      await waitFor(() =>
        expect(toastErrorSpy).toHaveBeenCalledWith(
          '12 time entries reference it. Deactivate it instead.',
        ),
      );
    });
  });

  describe('Given the list fails to load', () => {
    it('When the request rejects / Then an error state renders instead of a blank table', async () => {
      mockApi.getAll.mockRejectedValue(new Error('boom'));
      render(<LaborCategoriesPage />);

      expect(await screen.findByText("Couldn't load labor categories")).toBeInTheDocument();
    });
  });
});
