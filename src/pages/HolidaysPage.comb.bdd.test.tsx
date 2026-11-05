import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/holidaysService', () => ({
  holidaysApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), copyPreviousYear: vi.fn() },
}));
vi.mock('../services/workLocationsService', () => ({ workLocationsApi: { getAll: vi.fn() } }));
vi.mock('../services/mastersService', () => ({ mastersApi: { getAll: vi.fn() } }));
vi.mock('../services/departmentsService', () => ({ departmentsApi: { getAll: vi.fn() } }));

const flags = { manage: true };
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => flags.manage, hasPermission: () => true, currentTenant: { id: 't' }, currentOrg: { id: 'o' } }),
}));

import HolidaysPage from './HolidaysPage';
import { holidaysApi } from '../services/holidaysService';
import { workLocationsApi } from '../services/workLocationsService';
import { mastersApi } from '../services/mastersService';
import { departmentsApi } from '../services/departmentsService';
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
  (departmentsApi as any).getAll.mockResolvedValue({ data: [{ id: 'd1', name: 'Engineering' }] });
  api.update.mockResolvedValue({});
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

  // Pulse 8df0cba8 — active toggle, department scope, new types
  it('Given an active holiday row / When its Active switch is turned off / Then update sends is_active=false', async () => {
    renderPage();
    await screen.findByText('Republic Day');
    fireEvent.click(screen.getByRole('switch', { name: 'Active' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('h1', { is_active: false }));
  });

  it('Given an inactive holiday / When it loads / Then it shows an Inactive badge and its switch is off', async () => {
    api.getAll.mockResolvedValue({ data: [{ ...holiday, is_active: false }] });
    renderPage();
    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Active' })).not.toBeChecked();
  });

  it('Given a department-scoped holiday / When it loads / Then the scope shows the department name', async () => {
    api.getAll.mockResolvedValue({ data: [{ ...holiday, department_id: 'd1' }] });
    renderPage();
    expect(await screen.findByText('Engineering')).toBeInTheDocument();
  });

  it('Given Add Holiday with a department picked / When saved / Then create sends department_id and is_active', async () => {
    renderPage();
    await screen.findByText('Republic Day');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Holiday' })[0]);
    fireEvent.change(await screen.findByLabelText('Name *'), { target: { value: 'Onam' } });
    fireEvent.change(screen.getByLabelText('Date *'), { target: { value: '2030-09-01' } });
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'd1' } });
    fireEvent.submit(document.getElementById('holiday-form') as HTMLFormElement);
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Onam', department_id: 'd1', is_active: true })));
  });

  it('Given Add Holiday without a department / When saved / Then department_id is null (all departments)', async () => {
    renderPage();
    await screen.findByText('Republic Day');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Holiday' })[0]);
    fireEvent.change(await screen.findByLabelText('Name *'), { target: { value: 'Onam' } });
    fireEvent.change(screen.getByLabelText('Date *'), { target: { value: '2030-09-01' } });
    fireEvent.submit(document.getElementById('holiday-form') as HTMLFormElement);
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ department_id: null })));
  });

  it('Given a festival holiday / When it loads / Then the Festival type badge shows', async () => {
    api.getAll.mockResolvedValue({ data: [{ ...holiday, holiday_type: 'festival' }] });
    renderPage();
    // The type filter also lists Festival as an <option>; assert the row badge.
    expect(await screen.findByText('Festival', { selector: ':not(option)' })).toBeInTheDocument();
  });
});
