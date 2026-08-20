import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn() },
}));

vi.mock('../services/mastersService', () => ({
  mastersApi: { getAll: vi.fn() },
}));

vi.mock('../services/customFieldsService', () => ({
  customFieldDefsApi: { getAll: vi.fn() },
  personCustomFieldsApi: { getForPerson: vi.fn(), setForPerson: vi.fn() },
  CHOICE_FIELD_TYPES: ['dropdown', 'multi_select'],
}));

vi.mock('../services/settingsService', () => ({
  fetchOrgBaseCurrency: vi.fn().mockResolvedValue('USD'),
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    cancelInvite: vi.fn(),
    export: vi.fn(),
    getOrgRoles: vi.fn(),
    inviteUser: vi.fn(),
    getLaborCategoryOptions: vi.fn(),
  },
  apiContext: { getBaseUrl: vi.fn(() => '/people-api') },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

vi.mock('../hooks/useShellContext', () => ({
  usePeopleContext: () => ({ orgId: 'o1', tenantId: 't1', userId: 'u1' }),
}));

vi.mock('../services/apiClient', () => ({
  apiContext: { getBaseUrl: vi.fn(() => '/people-api') },
}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

import PeoplePage from './PeoplePage';
import { peopleApi } from '../services/peopleService';
import { departmentsApi } from '../services/departmentsService';
import { workLocationsApi } from '../services/workLocationsService';
import { mastersApi } from '../services/mastersService';
import { customFieldDefsApi } from '../services/customFieldsService';
import { fetchOrgBaseCurrency } from '../services/settingsService';

const mockApi = peopleApi as any;

const mockPerson = {
  id: 'p1',
  full_name: 'Alice Smith',
  email: 'alice@test.com',
  job_title: 'Engineer',
  department: 'Engineering',
  type: 'employee',
  status: 'active',
  cost_rate: 100,
  cost_rate_unit: 'hour',
  currency: 'USD',
  available_hours_per_day: 8,
  available_days_per_week: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const renderPage = () => render(<MemoryRouter><PeoplePage /></MemoryRouter>);

const openAddPerson = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /add person/i }));
  await waitFor(() => expect(screen.getByLabelText('Full Name *')).toBeInTheDocument());
};

const nameInput = () => screen.getByLabelText('Full Name *') as HTMLInputElement;
const emailInput = () => screen.getByLabelText('Email') as HTMLInputElement;
const phoneInput = () => screen.getByLabelText('Phone') as HTMLInputElement;
// The page header also has an "Add Person" button — scope to the drawer, whose
// footer (outside the <form>, wired via the form attribute) holds the submit.
const addButton = () => within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Person' });

/** Satisfies the "Invite as New User" defaults so only identity fields matter. */
const satisfyInviteFields = () => {
  fireEvent.change(screen.getByLabelText('Invitation role'), { target: { value: 'role-1' } });
};

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.getAll.mockResolvedValue({ data: [mockPerson], total: 1 });
  mockApi.getOrgRoles.mockResolvedValue({ data: [{ id: 'role-1', name: 'Employee' }] });
  mockApi.getLaborCategoryOptions.mockResolvedValue([]);
  mockApi.create.mockResolvedValue({ id: 'p2' });
  mockApi.inviteUser.mockResolvedValue({ invite_status: 'existing_user' });
  (departmentsApi as any).getTree.mockResolvedValue([]);
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (mastersApi as any).getAll.mockResolvedValue({ data: [] });
  (customFieldDefsApi as any).getAll.mockResolvedValue({ data: [] });
  // resetAllMocks() clears implementations declared in the vi.mock factories.
  (fetchOrgBaseCurrency as any).mockResolvedValue('USD');
});

describe('Given the Add Person modal', () => {
  it('When it opens with empty mandatory fields / Then the Add Person action is disabled', async () => {
    await openAddPerson();
    expect(addButton()).toBeDisabled();
  });

  it('When the form is submitted with invalid data / Then no API call is made', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: '897+46+4+61' } });
    fireEvent.click(addButton());
    expect(mockApi.create).not.toHaveBeenCalled();
  });

  it('When a numeric/symbol-only full name is entered / Then an application-level inline error is shown', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: '897+46+4+61' } });

    expect(await screen.findByText(/valid full name/i)).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('When a malformed email is entered / Then an inline error is shown and the form stays blocked', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: 'Henry Ford' } });
    fireEvent.change(emailInput(), { target: { value: 'henry@gmail.com74166^(*)_)' } });

    // Shown for both the identity email and the invite email, which mirrors it.
    expect((await screen.findAllByText('Please enter a valid email address.')).length).toBeGreaterThan(0);
    expect(addButton()).toBeDisabled();
  });

  it('When a phone number with letters and symbols is entered / Then an inline error is shown', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: 'Henry Ford' } });
    fireEvent.change(phoneInput(), { target: { value: '*745dsdhkdklmdhdj/*/@#$' } });

    expect((await screen.findAllByText(/phone number/i)).length).toBeGreaterThan(0);
    expect(addButton()).toBeDisabled();
  });

  it('When several fields are invalid / Then a validation summary is shown near the action', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: '123' } });
    fireEvent.change(emailInput(), { target: { value: 'nope' } });

    expect(await screen.findByText(/fields need attention/i)).toBeInTheDocument();
  });

  it('When an invalid value is corrected / Then the inline error clears and the action re-enables', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: '123' } });
    expect(await screen.findByText(/valid full name/i)).toBeInTheDocument();

    fireEvent.change(nameInput(), { target: { value: 'Henry Ford' } });
    fireEvent.change(emailInput(), { target: { value: 'henry@ford.com' } });
    satisfyInviteFields();

    await waitFor(() => expect(screen.queryByText(/valid full name/i)).not.toBeInTheDocument());
    await waitFor(() => expect(addButton()).not.toBeDisabled());
  });

  it('When all fields are valid / Then the person is created with a trimmed name', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: '  Henry Ford  ' } });
    fireEvent.change(emailInput(), { target: { value: 'henry@ford.com' } });
    fireEvent.change(phoneInput(), { target: { value: '+1-555-0100' } });
    satisfyInviteFields();

    await waitFor(() => expect(addButton()).not.toBeDisabled());
    fireEvent.click(addButton());

    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
    expect(mockApi.create.mock.calls[0][0]).toMatchObject({ full_name: 'Henry Ford', email: 'henry@ford.com' });
  });

  it('When the invite role is missing and the form is submitted anyway / Then the invite section shows its own inline error', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: 'Henry Ford' } });
    fireEvent.change(emailInput(), { target: { value: 'henry@ford.com' } });

    // Submit directly: the button is already disabled, and this also covers a
    // submit arriving from any other path (Enter key, programmatic).
    fireEvent.submit(nameInput().closest('form')!);

    expect(await screen.findByText('Select a role for the invited user.')).toBeInTheDocument();
    expect(mockApi.create).not.toHaveBeenCalled();
  });

  it('When a submit is rejected / Then focus moves to the first invalid field so the error is never off-screen', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: '123' } });

    fireEvent.submit(nameInput().closest('form')!);

    await waitFor(() => expect(document.activeElement).toBe(nameInput()));
  });

  it('When the form is rendered / Then browser-native validation is turned off in favour of inline messages', async () => {
    await openAddPerson();
    const form = nameInput().closest('form');
    expect(form).toHaveAttribute('novalidate');
  });
});

// The invitation email used to be an editable field defaulting to `inviteEmail || email`.
// The first keystroke forked the two values, so the invite went to one address while the
// person record carried another — and Core, which resolves the invitee's person by email,
// then created a duplicate person instead of linking the one just added. The field is now
// a read-only mirror: the Identity email is the single source of truth.
describe('Given the "Invite as New User" section', () => {
  const inviteEmailInput = () => screen.getByLabelText('Email for invitation') as HTMLInputElement;

  it('When an Identity email is typed / Then the invitation email mirrors it', async () => {
    await openAddPerson();
    fireEvent.change(emailInput(), { target: { value: 'henry@ford.com' } });

    await waitFor(() => expect(inviteEmailInput()).toHaveValue('henry@ford.com'));
  });

  it('When the Identity email is changed again / Then the invitation email follows the new value', async () => {
    await openAddPerson();
    fireEvent.change(emailInput(), { target: { value: 'first@ford.com' } });
    await waitFor(() => expect(inviteEmailInput()).toHaveValue('first@ford.com'));

    fireEvent.change(emailInput(), { target: { value: 'second@ford.com' } });
    await waitFor(() => expect(inviteEmailInput()).toHaveValue('second@ford.com'));
  });

  it('When the invitation email field is rendered / Then it is read-only so the two values can never diverge', async () => {
    await openAddPerson();
    expect(inviteEmailInput()).toHaveAttribute('readonly');
  });

  it('When an Identity email is present / Then the section states which address will receive the invitation', async () => {
    await openAddPerson();
    fireEvent.change(emailInput(), { target: { value: 'henry@ford.com' } });

    expect(await screen.findByText(/The invitation will be emailed to/i)).toBeInTheDocument();
  });

  it('When the person is submitted / Then the invitation is sent to the Identity email', async () => {
    mockApi.create.mockResolvedValue({ id: 'p2' });
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: 'Henry Ford' } });
    fireEvent.change(emailInput(), { target: { value: 'henry@ford.com' } });
    satisfyInviteFields();

    await waitFor(() => expect(addButton()).not.toBeDisabled());
    fireEvent.click(addButton());

    await waitFor(() => expect(mockApi.inviteUser).toHaveBeenCalledWith('p2', 'henry@ford.com', 'role-1', true));
  });

  it('When invite mode is on with no Identity email / Then the invite section says where to add one and submit stays blocked', async () => {
    await openAddPerson();
    fireEvent.change(nameInput(), { target: { value: 'Henry Ford' } });
    satisfyInviteFields();

    fireEvent.submit(nameInput().closest('form')!);

    expect(await screen.findByText(/Add an email in the Identity section/i)).toBeInTheDocument();
    expect(mockApi.create).not.toHaveBeenCalled();
  });
});

describe('Given the People Registry filter bar', () => {
  it('When no filter is applied / Then no Clear Filters action is offered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('When a filter is applied / Then a Clear Filters action appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Search by name, email, or title...'), { target: { value: 'ali' } });

    expect(await screen.findByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('When Clear Filters is used / Then every control returns to its default and the full list reloads', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    const searchBox = screen.getByPlaceholderText('Search by name, email, or title...') as HTMLInputElement;
    fireEvent.change(searchBox, { target: { value: 'ali' } });
    fireEvent.change(screen.getByLabelText('Joined from'), { target: { value: '2026-01-01' } });

    fireEvent.click(await screen.findByRole('button', { name: /clear filters/i }));

    await waitFor(() => expect(searchBox.value).toBe(''));
    expect((screen.getByLabelText('Joined from') as HTMLInputElement).value).toBe('');
    await waitFor(() => expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument());
    // The list query re-runs off the reset state — no extra user action needed.
    await waitFor(() => expect(mockApi.getAll).toHaveBeenCalled());
    const lastCall = mockApi.getAll.mock.calls[mockApi.getAll.mock.calls.length - 1][0];
    expect(lastCall.search).toBeUndefined();
    expect(lastCall.date_of_joining_from).toBeUndefined();
  });

  it('When the search box has text / Then a per-field clear control is offered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    const searchBox = screen.getByPlaceholderText('Search by name, email, or title...') as HTMLInputElement;
    fireEvent.change(searchBox, { target: { value: 'ali' } });

    fireEvent.click(await screen.findByLabelText('Clear search'));
    await waitFor(() => expect(searchBox.value).toBe(''));
  });

  it('When a joined date is set / Then a dedicated clear control resets the range', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Joined from'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Joined to'), { target: { value: '2026-06-01' } });

    fireEvent.click(await screen.findByLabelText('Clear joined date range'));

    await waitFor(() => expect((screen.getByLabelText('Joined from') as HTMLInputElement).value).toBe(''));
    expect((screen.getByLabelText('Joined to') as HTMLInputElement).value).toBe('');
  });
});

describe('Given the People Registry Import action', () => {
  it('When Import is clicked / Then it navigates straight to the Import workflow', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/people/import-export?tab=import');
  });
});
