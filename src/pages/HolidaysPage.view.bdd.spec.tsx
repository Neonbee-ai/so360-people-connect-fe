import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/holidaysService', () => ({
  holidaysApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), copyPreviousYear: vi.fn() },
}));
vi.mock('../services/workLocationsService', () => ({ workLocationsApi: { getAll: vi.fn() } }));
vi.mock('../services/mastersService', () => ({ mastersApi: { getAll: vi.fn() } }));
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, hasPermission: () => true, currentTenant: { id: 't' }, currentOrg: { id: 'o' } }),
}));

import HolidaysPage from './HolidaysPage';
import { holidaysApi } from '../services/holidaysService';
import { workLocationsApi } from '../services/workLocationsService';
import { mastersApi } from '../services/mastersService';

const api = holidaysApi as any;
const rows = [
  { id: 'h1', name: 'Republic Day', holiday_date: '2030-01-26', holiday_type: 'national', is_optional: false, is_mandatory: true },
  { id: 'h2', name: 'Onam', holiday_date: '2030-09-05', holiday_type: 'regional', state: 'Kerala', is_optional: false, is_mandatory: true },
];
const renderPage = () => render(<MemoryRouter><HolidaysPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  api.getAll.mockResolvedValue({ data: rows });
  api.create.mockResolvedValue({});
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (mastersApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('HolidaysPage search, calendar and duplicate (8df0cba8)', () => {
  it('Given two holidays / When searching by state / Then only the matching holiday is listed', async () => {
    renderPage();
    await screen.findByText('Republic Day');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search holidays' }), { target: { value: 'kerala' } });
    await waitFor(() => expect(screen.queryByText('Republic Day')).not.toBeInTheDocument());
    expect(screen.getByText('Onam')).toBeInTheDocument();
  });

  it('Given the list view / When Calendar is chosen / Then a DS calendar shows every holiday as an event', async () => {
    renderPage();
    await screen.findByText('Republic Day');
    fireEvent.click(within(screen.getByRole('group', { name: 'Holiday view' })).getByRole('button', { name: 'Calendar' }));
    const cal = await screen.findByTestId('holiday-calendar');
    expect(within(cal).getByRole('button', { name: 'Republic Day' })).toHaveAttribute('data-start', '2030-01-26');
    expect(within(cal).getByRole('button', { name: 'Onam' })).toBeInTheDocument();
  });

  it('Given the calendar view / When an event is clicked / Then the edit modal opens for that holiday', async () => {
    renderPage();
    await screen.findByText('Republic Day');
    fireEvent.click(within(screen.getByRole('group', { name: 'Holiday view' })).getByRole('button', { name: 'Calendar' }));
    fireEvent.click(within(await screen.findByTestId('holiday-calendar')).getByRole('button', { name: 'Onam' }));
    expect(await screen.findByText('Edit Holiday')).toBeInTheDocument();
    expect(screen.getByLabelText('Name *')).toHaveValue('Onam');
  });

  it('Given a holiday row / When Duplicate is clicked and saved with a date / Then a new holiday is created, never an update', async () => {
    renderPage();
    await screen.findByText('Onam');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Onam' }));
    expect(await screen.findByLabelText('Name *')).toHaveValue('Onam (copy)');
    expect(screen.getByLabelText('Date *')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Date *'), { target: { value: '2031-08-25' } });
    fireEvent.submit(document.getElementById('holiday-form') as HTMLFormElement);
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Onam (copy)', holiday_date: '2031-08-25', state: 'Kerala', holiday_type: 'regional' })));
    expect(api.update).not.toHaveBeenCalled();
  });
});
