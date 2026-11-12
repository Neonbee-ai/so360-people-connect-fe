import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/companyEventsService', () => ({
  companyEventsApi: { getAll: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), cancel: vi.fn(), delete: vi.fn(), rsvp: vi.fn() },
}));
vi.mock('../services/departmentsService', () => ({ departmentsApi: { getAll: vi.fn() } }));
vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { timezone: 'UTC', document_language: 'en-US' } }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, hasPermission: () => true }),
}));

import CompanyEventsPage from './CompanyEventsPage';
import { companyEventsApi } from '../services/companyEventsService';
import { departmentsApi } from '../services/departmentsService';
import { toast } from '@so360/design-system';

const api = companyEventsApi as any;

const baseEvent = {
  id: 'e1', title: 'Town hall', description: null, event_type: 'town_hall',
  starts_at: '2099-03-01T09:00:00.000Z', ends_at: '2099-03-01T10:00:00.000Z', all_day: false, timezone: null,
  location: 'HQ', meeting_url: null, audience_type: 'everyone', audience_department_ids: [], audience_person_ids: [],
  rsvp_enabled: true, status: 'scheduled', rsvp: { going: 2, maybe: 1, declined: 0, my_response: null },
  can_edit: false, can_delete: false, can_view_attendees: false,
};
const list = (events: any[], can_create = false) => ({ data: events, permissions: { can_create, can_manage: false } });
const renderPage = () => render(<MemoryRouter><CompanyEventsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  api.getAll.mockResolvedValue(list([baseEvent]));
  api.create.mockResolvedValue({});
  api.update.mockResolvedValue({});
  api.cancel.mockResolvedValue({});
  api.rsvp.mockResolvedValue({});
  api.delete.mockResolvedValue({ message: 'Event deleted' });
  (departmentsApi as any).getAll.mockResolvedValue({ data: [{ id: 'd1', name: 'Sales' }] });
});

describe('CompanyEventsPage (Comb)', () => {
  it('Given an invited user / When the page loads / Then the event, type, audience and RSVP counts show', async () => {
    renderPage();
    expect(await screen.findByText('Town hall', { selector: 'span.font-medium' })).toBeInTheDocument();
    expect(screen.getByText('Everyone')).toBeInTheDocument();
    expect(screen.getByText('HQ')).toBeInTheDocument();
    expect(screen.getByText('2 going · 1 maybe')).toBeInTheDocument();
    expect(api.getAll).toHaveBeenCalledWith({ when: 'upcoming', include_cancelled: 'true' });
  });

  it('Given a user without create rights / When the page loads / Then New Event and row actions are hidden', async () => {
    renderPage();
    await screen.findByText('2 going · 1 maybe');
    expect(screen.queryByRole('button', { name: /New Event/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('Given an open event / When the user picks Going / Then the RSVP is sent and the list reloads', async () => {
    renderPage();
    const group = await screen.findByRole('group', { name: 'Your response to Town hall' });
    fireEvent.click(within(group).getByText('Going'));
    await waitFor(() => expect(api.rsvp).toHaveBeenCalledWith('e1', 'going'));
    await waitFor(() => expect(api.getAll).toHaveBeenCalledTimes(2));
  });

  it('Given the RSVP fails / When the user responds / Then an error toast shows', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.rsvp.mockRejectedValue(new Error('This event is not open for RSVP'));
    renderPage();
    const group = await screen.findByRole('group', { name: 'Your response to Town hall' });
    fireEvent.click(within(group).getByText('Maybe'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('This event is not open for RSVP'));
  });

  it('Given a cancelled event / When it renders / Then a Cancelled badge shows and no RSVP control', async () => {
    api.getAll.mockResolvedValue(list([{ ...baseEvent, status: 'cancelled' }]));
    renderPage();
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Your response to Town hall' })).not.toBeInTheDocument();
  });

  it('Given RSVP is disabled / When it renders / Then the RSVP cell is a dash', async () => {
    api.getAll.mockResolvedValue(list([{ ...baseEvent, rsvp_enabled: false }]));
    renderPage();
    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('Given a department audience / When it renders / Then department names show', async () => {
    api.getAll.mockResolvedValue(list([{ ...baseEvent, audience_type: 'department', audience_department_ids: ['d1'] }]));
    renderPage();
    expect(await screen.findByText('Sales')).toBeInTheDocument();
  });

  it('Given a people audience / When it renders / Then the invitee count shows', async () => {
    api.getAll.mockResolvedValue(list([{ ...baseEvent, audience_type: 'people', audience_person_ids: ['p1', 'p2'] }]));
    renderPage();
    expect(await screen.findByText('2 people')).toBeInTheDocument();
  });

  it('Given an all-day event / When it renders / Then it is labelled all day', async () => {
    api.getAll.mockResolvedValue(list([{ ...baseEvent, all_day: true, ends_at: '2099-03-01T09:30:00.000Z' }]));
    renderPage();
    expect(await screen.findByText(/\(all day\)/)).toBeInTheDocument();
  });

  it('Given no events / When it loads / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue(list([]));
    renderPage();
    expect(await screen.findByText('No upcoming events')).toBeInTheDocument();
  });

  it('Given the list fails / When it loads / Then an error toast shows', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.getAll.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('boom'));
  });

  it('Given the list view / When Past is chosen / Then past events are requested', async () => {
    renderPage();
    await screen.findByText('2 going · 1 maybe');
    fireEvent.click(within(screen.getByRole('group', { name: 'Event period' })).getByText('Past'));
    await waitFor(() => expect(api.getAll).toHaveBeenCalledWith({ when: 'past', include_cancelled: 'true' }));
  });

  it('Given a creator / When New Event is filled and saved / Then create gets UTC times and the audience', async () => {
    api.getAll.mockResolvedValue(list([], true));
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /New Event/ }))[0]);
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Offsite' } });
    fireEvent.change(screen.getByLabelText('Starts *'), { target: { value: '2099-05-01T09:00' } });
    fireEvent.change(screen.getByLabelText('Ends *'), { target: { value: '2099-05-01T17:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Offsite', starts_at: '2099-05-01T09:00:00.000Z', ends_at: '2099-05-01T17:00:00.000Z',
      audience_type: 'everyone', audience_department_ids: [], rsvp_enabled: true,
    })));
  });

  it('Given the form / When end is before start / Then a validation error shows and nothing is created', async () => {
    api.getAll.mockResolvedValue(list([], true));
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /New Event/ }))[0]);
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Offsite' } });
    fireEvent.change(screen.getByLabelText('Starts *'), { target: { value: '2099-05-01T17:00' } });
    fireEvent.change(screen.getByLabelText('Ends *'), { target: { value: '2099-05-01T09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    expect(await screen.findByText('End must be after start')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('Given the form / When times are missing / Then it asks for start and end', async () => {
    api.getAll.mockResolvedValue(list([], true));
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /New Event/ }))[0]);
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Offsite' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    expect(await screen.findByText('Start and end are required')).toBeInTheDocument();
  });

  it('Given a department audience with none picked / When saved / Then it asks for a department; picking one creates', async () => {
    api.getAll.mockResolvedValue(list([], true));
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /New Event/ }))[0]);
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Sales sync' } });
    fireEvent.change(screen.getByLabelText('Starts *'), { target: { value: '2099-05-01T09:00' } });
    fireEvent.change(screen.getByLabelText('Ends *'), { target: { value: '2099-05-01T10:00' } });
    fireEvent.change(screen.getByLabelText('Who is invited'), { target: { value: 'department' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    expect(await screen.findByText('Pick at least one department')).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText('Sales'));
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      audience_type: 'department', audience_department_ids: ['d1'],
    })));
  });

  it('Given an all-day event in the form / When saved / Then it spans the whole day', async () => {
    api.getAll.mockResolvedValue(list([], true));
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /New Event/ }))[0]);
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Founders day' } });
    fireEvent.click(screen.getByRole('switch', { name: 'All day' }));
    fireEvent.change(screen.getByLabelText('Start date *'), { target: { value: '2099-06-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      all_day: true, starts_at: '2099-06-10T00:00:00.000Z', ends_at: '2099-06-10T23:59:00.000Z',
    })));
  });

  it('Given create fails / When saved / Then the server error is toasted', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.getAll.mockResolvedValue(list([], true));
    api.create.mockRejectedValue(new Error('Unknown department'));
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /New Event/ }))[0]);
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText('Starts *'), { target: { value: '2099-05-01T09:00' } });
    fireEvent.change(screen.getByLabelText('Ends *'), { target: { value: '2099-05-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Unknown department'));
  });

  it('Given an editable event / When edited and saved / Then update is called with the new title', async () => {
    api.getAll.mockResolvedValue(list([{ ...baseEvent, can_edit: true }]));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Starts *')).toHaveValue('2099-03-01T09:00');
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Town hall Q2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('e1', expect.objectContaining({ title: 'Town hall Q2' })));
  });

  it('Given an editable event / When Cancel event is clicked / Then the event is cancelled', async () => {
    api.getAll.mockResolvedValue(list([{ ...baseEvent, can_edit: true }]));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel event' }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('e1'));
  });

  it('Given cancelling fails / When Cancel event is clicked / Then an error toast shows', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.getAll.mockResolvedValue(list([{ ...baseEvent, can_edit: true }]));
    api.cancel.mockRejectedValue(new Error('nope'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel event' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('nope'));
  });

  it('Given a deletable event / When Delete is confirmed / Then the event is deleted', async () => {
    api.getAll.mockResolvedValue(list([{ ...baseEvent, can_delete: true }]));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Event' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('e1'));
  });

  it('Given delete fails / When confirmed / Then an error toast shows', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.getAll.mockResolvedValue(list([{ ...baseEvent, can_delete: true }]));
    api.delete.mockRejectedValue(new Error('Forbidden'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Event' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Forbidden'));
  });
});
