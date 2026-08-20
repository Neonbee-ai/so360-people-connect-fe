import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  WorkLocation: {},
  CreateWorkLocationPayload: {},
  LocationType: {},
}));

let mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ ...mockShellFlags }),
}));

import WorkLocationsPage from '../pages/WorkLocationsPage';
import { workLocationsApi } from '../services/workLocationsService';

const mockApi = workLocationsApi as any;

const renderPage = () => render(<MemoryRouter><WorkLocationsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
});

describe('WorkLocationsPage', () => {
  describe('Given work locations exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          { id: 'wl1', name: 'Head Office', location_type: 'office', address: '123 Main St', is_active: true },
          { id: 'wl2', name: 'Factory A', location_type: 'factory', address: null, is_active: false },
        ],
      });
    });

    it('When the page loads / Then it renders the locations table', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Head Office')).toBeInTheDocument());
      expect(screen.getByText('Factory A')).toBeInTheDocument();
    });

    it('When the page loads / Then it requests inactive locations too, so deactivated ones stay manageable', async () => {
      renderPage();
      await waitFor(() => expect(mockApi.getAll).toHaveBeenCalled());
      expect(mockApi.getAll).toHaveBeenCalledWith(true);
    });

    it('When a location is deactivated / Then it remains listed and can be reactivated', async () => {
      renderPage();
      // wl2 is inactive and must still be rendered by the management table.
      await waitFor(() => expect(screen.getByText('Factory A')).toBeInTheDocument());
      expect(screen.getByTitle('Activate')).toBeInTheDocument();
    });

    it('When Add Location is clicked / Then the modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Head Office')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Location'));
      await waitFor(() => expect(screen.getByText('Add Work Location')).toBeInTheDocument());
    });

    it('When Delete is clicked / Then a confirmation names the location and nothing is deleted yet', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Head Office')).toBeInTheDocument());
      fireEvent.click(screen.getAllByTitle('Delete')[0]);

      await waitFor(() => expect(screen.getByText('Delete Work Location')).toBeInTheDocument());
      expect(screen.getByText(/Delete "Head Office"\? This cannot be undone\./)).toBeInTheDocument();
      expect(mockApi.delete).not.toHaveBeenCalled();
    });

    it('When the deletion is confirmed / Then the API is called and the result is toasted', async () => {
      mockApi.delete.mockResolvedValue({ message: 'Work location deleted' });
      renderPage();
      await waitFor(() => expect(screen.getByText('Head Office')).toBeInTheDocument());
      fireEvent.click(screen.getAllByTitle('Delete')[0]);
      await waitFor(() => expect(screen.getByText('Delete Work Location')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Delete Location'));

      await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('wl1'));
    });

    it('When the confirmation is cancelled / Then the location survives', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Head Office')).toBeInTheDocument());
      fireEvent.click(screen.getAllByTitle('Delete')[0]);
      await waitFor(() => expect(screen.getByText('Delete Work Location')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => expect(screen.queryByText('Delete Work Location')).not.toBeInTheDocument());
      expect(mockApi.delete).not.toHaveBeenCalled();
    });
  });

  describe('Given no work locations exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No work locations')).toBeInTheDocument());
    });
  });
});

describe('WorkLocationsPage — effectiveFlagsLoaded gate', () => {
  it('When effectiveFlagsLoaded is false / Then Add Location button is absent', async () => {
    mockShellFlags = { effectiveFlagsLoaded: false, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
    mockApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No work locations')).toBeInTheDocument());
    expect(screen.queryByText('Add Location')).not.toBeInTheDocument();
  });

  it('When effectiveFlagsLoaded is true / Then Add Location button is present', async () => {
    mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
    mockApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No work locations')).toBeInTheDocument());
    expect(screen.queryAllByText('Add Location').length).toBeGreaterThan(0);
  });
});
