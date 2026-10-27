import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/holidaysService', () => ({
  holidaysApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), copyPreviousYear: vi.fn() },
}));
vi.mock('../services/workLocationsService', () => ({ workLocationsApi: { getAll: vi.fn() } }));
vi.mock('../services/mastersService', () => ({ mastersApi: { getAll: vi.fn() } }));

const flags = { manage: true };
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => flags.manage, hasPermission: () => true, currentTenant: { id: 't' }, currentOrg: { id: 'o' } }),
}));

import HolidaysPage from './HolidaysPage';
import { holidaysApi } from '../services/holidaysService';
import { workLocationsApi } from '../services/workLocationsService';
import { mastersApi } from '../services/mastersService';
import { toast } from '@so360/design-system';

const api = holidaysApi as any;
const holiday = { id: 'h1', name: 'Republic Day', holiday_date: '2030-01-26', holiday_type: 'national', is_optional: false, is_mandatory: true };
const renderPage = () => render(<MemoryRouter><HolidaysPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  flags.manage = true;
  api.getAll.mockResolvedValue({ data: [holiday] });
  api.create.mockResolvedValue({});
  api.delete.mockResolvedValue({ message: 'Deleted' });
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (mastersApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('HolidaysPage (Comb)', () => {
  it('Given the page / When it loads / Then title, month group and holiday show', async () => {
    renderPage();
    expect(await screen.findByText('Republic Day')).toBeInTheDocument();
    expect(screen.getByText('Holiday Calendar')).toBeInTheDocument();
    expect(screen.getByText('January')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add Holiday' }).length).toBeGreaterThan(0);
  });

  it('Given no holidays / When it loads / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText('No holidays')).toBeInTheDocument();
  });

  it('Given the list is pending / When it renders / Then a loading status shows', () => {
    api.getAll.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('Given a manager / When Add Holiday is filled and saved / Then create is called with the payload', async () => {
    renderPage();
    await screen.findByText('Republic Day');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Holiday' })[0]);
    fireEvent.change(await screen.findByLabelText('Name *'), { target: { value: 'Diwali' } });
    fireEvent.change(screen.getByLabelText('Date *'), { target: { value: '2030-11-01' } });
    fireEvent.submit(document.getElementById('holiday-form') as HTMLFormElement);
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Diwali', holiday_date: '2030-11-01' })));
  });

  it('Given a holiday row / When Delete is clicked / Then delete is called with its id', async () => {
    renderPage();
    await screen.findByText('Republic Day');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('h1'));
  });

  it('Given the create flag is off / When it loads / Then manage actions are hidden', async () => {
    flags.manage = false;
    renderPage();
    await screen.findByText('Republic Day');
    expect(screen.queryByRole('button', { name: 'Add Holiday' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('Given the load fails / When it renders / Then an error toast shows', async () => {
    api.getAll.mockRejectedValue(new Error('x'));
    const spy = vi.spyOn(toast, 'error');
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load holidays'));
  });
});
