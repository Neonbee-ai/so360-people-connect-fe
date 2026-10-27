import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';

vi.mock('../services/shiftsService', () => ({
  shiftsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

let flags: any;
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ ...flags }) }));

import ShiftsPage from './ShiftsPage';
import { shiftsApi } from '../services/shiftsService';

const api = shiftsApi as any;
const SHIFT = { id: 's1', name: 'Morning', start_time: '09:00', end_time: '18:00', grace_period_minutes: 10, break_duration_minutes: 30, is_night_shift: false, is_active: true };
const renderPage = () => render(<MemoryRouter><ShiftsPage /></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
  Object.values(api).forEach((f: any) => f.mockReset());
  flags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
});

describe('ShiftsPage (Comb)', () => {
  it('Given shifts / When loaded / Then title, primary action and rows render', async () => {
    api.getAll.mockResolvedValue({ data: [SHIFT] });
    renderPage();
    expect(screen.getByText('Shift Management')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Morning')).toBeInTheDocument());
    expect(screen.getByText('Add Shift')).toBeInTheDocument();
  });

  it('Given a pending fetch / When rendered / Then the loading state shows', () => {
    api.getAll.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it('Given no shifts / When loaded / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No shifts')).toBeInTheDocument());
  });

  it('Given the create form / When submitted / Then create is called with the payload', async () => {
    api.getAll.mockResolvedValue({ data: [SHIFT] });
    api.create.mockResolvedValue({ id: 'n' });
    renderPage();
    await waitFor(() => screen.getByText('Morning'));
    fireEvent.click(screen.getByText('Add Shift'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Morning Shift'), { target: { value: 'Evening' } });
    fireEvent.click(screen.getByText('Add Shift', { selector: 'button[type="submit"]' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Evening', start_time: '09:00', end_time: '18:00', grace_period_minutes: 0 })));
  });

  it('Given create permission is off / When loaded / Then no Add Shift or row actions', async () => {
    flags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => false };
    api.getAll.mockResolvedValue({ data: [SHIFT] });
    renderPage();
    await waitFor(() => screen.getByText('Morning'));
    expect(screen.queryByText('Add Shift')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('Given the load fails / When rendered / Then an error toast is shown', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.getAll.mockRejectedValue(new Error('x'));
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load shifts'));
  });
});
