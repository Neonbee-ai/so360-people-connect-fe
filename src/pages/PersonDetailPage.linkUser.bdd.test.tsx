import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getById: vi.fn(),
    update: vi.fn(),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    getEmploymentHistory: vi.fn(),
    getRateHistory: vi.fn(),
    linkUser: vi.fn(),
    inviteUser: vi.fn(),
    getOrgRoles: vi.fn(),
    updateSystemRole: vi.fn(),
  },
  allocationsApi: { getAll: vi.fn() },
}));

vi.mock('../services/timesheetApi', () => ({ timesheetApi: { getEntries: vi.fn() } }));
vi.mock('../services/goalsService', () => ({ goalsApi: { getAll: vi.fn() }, Goal: {} }));
vi.mock('../services/workLocationsService', () => ({
  workLocationsApi: { getAll: vi.fn() },
  WorkLocation: {},
}));

// The real UserSelector fetches /v1/tenancy/members; stub it down to a plain
// select so these tests stay about the link workflow, not the picker's internals.
vi.mock('../components/UserSelector', () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <select aria-label={placeholder} value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">none</option>
      <option value="u-42">Bob Jones</option>
    </select>
  ),
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

import PersonDetailPage from './PersonDetailPage';
import { peopleApi, allocationsApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import { goalsApi } from '../services/goalsService';
import { workLocationsApi } from '../services/workLocationsService';

const mockPeopleApi = peopleApi as any;

const unlinkedPerson = {
  id: 'p1',
  full_name: 'Alice Smith',
  email: 'alice@test.com',
  job_title: 'Engineer',
  type: 'employee',
  status: 'active',
  cost_rate: 100,
  cost_rate_unit: 'hour',
  currency: 'USD',
  available_hours_per_day: 8,
  available_days_per_week: 5,
  people_roles: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/people/p1']}>
      <Routes>
        <Route path="/people/:id" element={<PersonDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

const openLinkModal = async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText('Link User')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Link User'));
  await waitFor(() => expect(screen.getByText('Link User Account')).toBeInTheDocument());
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getById.mockResolvedValue(unlinkedPerson);
  mockPeopleApi.getOrgRoles.mockResolvedValue({ data: [] });
  (allocationsApi as any).getAll.mockResolvedValue({ data: [] });
  (timesheetApi as any).getEntries.mockResolvedValue({ data: [] });
  (goalsApi as any).getAll.mockResolvedValue({ data: [] });
  (workLocationsApi as any).getAll.mockResolvedValue({ data: [] });
});

describe('Given a person with no linked user account', () => {
  it('When Link User is clicked / Then the link dialog opens instead of doing nothing', async () => {
    await openLinkModal();
    expect(screen.getByText('Link User Account')).toBeInTheDocument();
    expect(screen.getByLabelText('Search users by name or email...')).toBeInTheDocument();
  });

  it('When the dialog opens with no user chosen / Then the confirm button is disabled', async () => {
    await openLinkModal();
    expect(screen.getByRole('button', { name: 'Link Account' })).toBeDisabled();
  });

  it('When a user is chosen and confirmed / Then the person is linked through the API', async () => {
    mockPeopleApi.linkUser.mockResolvedValue({ ...unlinkedPerson, user_id: 'u-42' });
    await openLinkModal();

    fireEvent.change(screen.getByLabelText('Search users by name or email...'), { target: { value: 'u-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Link Account' }));

    await waitFor(() => expect(mockPeopleApi.linkUser).toHaveBeenCalledWith('p1', 'u-42'));
  });

  it('When linking succeeds / Then the header switches to the linked badge', async () => {
    mockPeopleApi.linkUser.mockResolvedValue({ ...unlinkedPerson, user_id: 'u-42' });
    await openLinkModal();

    fireEvent.change(screen.getByLabelText('Search users by name or email...'), { target: { value: 'u-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Link Account' }));

    await waitFor(() => expect(screen.getByText('Linked to user account')).toBeInTheDocument());
  });

  it('When the link call fails / Then the error is shown in the dialog rather than failing silently', async () => {
    mockPeopleApi.linkUser.mockRejectedValue(new Error('User already linked to another person'));
    await openLinkModal();

    fireEvent.change(screen.getByLabelText('Search users by name or email...'), { target: { value: 'u-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Link Account' }));

    expect(await screen.findByText('User already linked to another person')).toBeInTheDocument();
    expect(screen.getByText('Link User Account')).toBeInTheDocument();
  });
});

describe('Given a person already linked to a user account', () => {
  it('When the page loads / Then the Link User button is not offered', async () => {
    mockPeopleApi.getById.mockResolvedValue({ ...unlinkedPerson, user_id: 'u-9' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Linked to user account')).toBeInTheDocument());
    expect(screen.queryByText('Link User')).not.toBeInTheDocument();
  });
});
