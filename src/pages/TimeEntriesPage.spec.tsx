import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  timeEntriesApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
  peopleApi: { getAll: vi.fn() },
  allocationsApi: { getAll: vi.fn() },
  entitiesApi: { list: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
  useBusinessSettings: () => ({ settings: { currency: "USD", timezone: "UTC" } }),}));

import TimeEntriesPage from './TimeEntriesPage';
import { timeEntriesApi, peopleApi, allocationsApi, entitiesApi } from '../services/peopleService';

const mockTimeApi = timeEntriesApi as any;
const mockPeopleApi = peopleApi as any;
const mockAllocApi = allocationsApi as any;
const mockEntitiesApi = entitiesApi as any;

const renderPage = () => render(<MemoryRouter><TimeEntriesPage /></MemoryRouter>);

const mockEntry = {
  id: 'te1',
  person: { id: 'p1', full_name: 'Alice', job_title: 'Engineer' },
  entity_name: 'Project X',
  entity_type: 'project',
  work_date: '2024-06-15',
  hours: 8,
  total_cost: 800,
  currency: 'USD',
  status: 'draft',
  description: 'Feature development',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
  mockAllocApi.getAll.mockResolvedValue({ data: [] });
  mockEntitiesApi.list.mockResolvedValue({ data: [] });
});

describe('Given TimeEntriesPage loads with entries', () => {
  beforeEach(() => {
    mockTimeApi.getAll.mockResolvedValue({ data: [mockEntry], total: 1 });
  });

  it('When page loads / Then "Time Entries" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Time Entries')).toBeInTheDocument());
  });

  it('When entries are fetched / Then person name is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('When entries are fetched / Then entity name is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Project X')).toBeInTheDocument());
  });

  it('When entries are fetched / Then hours are shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/8h/)).toBeInTheDocument());
  });
});

describe('Given TimeEntriesPage with no entries', () => {
  beforeEach(() => {
    mockTimeApi.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('When no entries exist / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No time entries/i)).toBeInTheDocument());
  });
});

describe('Given TimeEntriesPage status filter', () => {
  beforeEach(() => {
    mockTimeApi.getAll.mockResolvedValue({ data: [mockEntry], total: 1 });
  });

  it('When status filter changes / Then API is called with new status', async () => {
    renderPage();
    await waitFor(() => expect(mockTimeApi.getAll).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'approved' } });
    await waitFor(() =>
      expect(mockTimeApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }))
    );
  });
});

describe('Given TimeEntriesPage API failure', () => {
  beforeEach(() => {
    mockTimeApi.getAll.mockRejectedValue(new Error('Failed'));
  });

  it('When API fails / Then error toast is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load time entries')).toBeInTheDocument());
  });
});

describe('Given the log-time form is submitted', () => {
  const PERSON_UUID = '22222222-2222-4222-8222-222222222222';
  const ENTITY_UUID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    mockTimeApi.getAll.mockResolvedValue({ data: [mockEntry], total: 1 });
    mockPeopleApi.getAll.mockResolvedValue({
      data: [{ id: PERSON_UUID, full_name: 'Alice', job_title: 'Engineer', type: 'employee', cost_rate: 50, cost_rate_unit: 'hour' }],
    });
    mockEntitiesApi.list.mockResolvedValue({ data: [{ id: ENTITY_UUID, name: 'Website Redesign' }] });
    mockTimeApi.create.mockResolvedValue({ id: 'te-new' });
  });

  const openModal = async () => {
    const view = renderPage();
    await waitFor(() => expect(screen.getByText('Project X')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Log Time'));
    await waitFor(() => expect(screen.getByRole('option', { name: /Alice/ })).toBeInTheDocument());
    return view;
  };

  it('When no entity is selected / Then it shows a validation error and create is not called', async () => {
    const { container } = await openModal();
    fireEvent.change(screen.getByDisplayValue('Select person...'), { target: { value: PERSON_UUID } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(screen.getByText(/Entity is required/)).toBeInTheDocument());
    expect(mockTimeApi.create).not.toHaveBeenCalled();
  });

  it('When an entity is picked from the dropdown / Then create is called with its UUID', async () => {
    const { container } = await openModal();
    fireEvent.change(screen.getByDisplayValue('Select person...'), { target: { value: PERSON_UUID } });
    // Open the entity dropdown and choose the loaded option (stores its UUID).
    fireEvent.click(screen.getByText('Select project...'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Website Redesign' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Website Redesign' }));
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(mockTimeApi.create).toHaveBeenCalledTimes(1));
    const payload = mockTimeApi.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      person_id: PERSON_UUID,
      entity_type: 'project',
      entity_id: ENTITY_UUID,
      entity_name: 'Website Redesign',
      hours: 1,
    });
    expect(typeof payload.hours).toBe('number');
  });

  it('When entity type is internal / Then entity_id is optional and create is called without it', async () => {
    const { container } = await openModal();
    fireEvent.change(screen.getByDisplayValue('Select person...'), { target: { value: PERSON_UUID } });
    fireEvent.change(screen.getByDisplayValue('Project'), { target: { value: 'internal' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(mockTimeApi.create).toHaveBeenCalledTimes(1));
    const payload = mockTimeApi.create.mock.calls[0][0];
    expect(payload.entity_type).toBe('internal');
    expect(payload.entity_id).toBeUndefined();
  });
});
