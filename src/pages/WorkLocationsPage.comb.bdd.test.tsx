import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

let flags: any;
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ ...flags }) }));

import WorkLocationsPage from './WorkLocationsPage';
import { workLocationsApi } from '../services/workLocationsService';

const api = workLocationsApi as any;
const LOC = { id: 'wl1', name: 'Head Office', location_type: 'office', address: '123 Main St', is_active: true };
const renderPage = () => render(<MemoryRouter><WorkLocationsPage /></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
  Object.values(api).forEach((f: any) => f.mockReset());
  flags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
});

describe('WorkLocationsPage (Comb)', () => {
  it('Given locations / When loaded / Then title, primary action and rows render', async () => {
    api.getAll.mockResolvedValue({ data: [LOC] });
    renderPage();
    expect(screen.getByText('Work Locations')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Head Office')).toBeInTheDocument());
    expect(screen.getByText('Add Location')).toBeInTheDocument();
  });

  it('Given a pending fetch / When rendered / Then loading shows', () => {
    api.getAll.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it('Given no locations / When loaded / Then the empty state renders without a table', async () => {
    api.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('Given the active switch / When toggled / Then update is called with the flipped state', async () => {
    api.getAll.mockResolvedValue({ data: [LOC] });
    api.update.mockResolvedValue({});
    renderPage();
    await waitFor(() => screen.getByText('Head Office'));
    fireEvent.click(screen.getByRole('switch', { name: 'Deactivate' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('wl1', { is_active: false }));
  });

  it('Given manage is disabled / When loaded / Then no Add Location or row actions', async () => {
    flags = { ...flags, isFeatureEnabled: () => false };
    api.getAll.mockResolvedValue({ data: [LOC] });
    renderPage();
    await waitFor(() => screen.getByText('Head Office'));
    expect(screen.queryByText('Add Location')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument();
  });

  it('Given the load fails / When rendered / Then an error toast is shown', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.getAll.mockRejectedValue(new Error('x'));
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load work locations'));
  });
});
