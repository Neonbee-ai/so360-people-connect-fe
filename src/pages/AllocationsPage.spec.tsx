import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  allocationsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
  peopleApi: { getAll: vi.fn() },
  entitiesApi: { list: vi.fn() },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),}));

import AllocationsPage from './AllocationsPage';
import { allocationsApi, peopleApi, entitiesApi } from '../services/peopleService';

const mockAllocApi = allocationsApi as any;
const mockPeopleApi = peopleApi as any;
const mockEntitiesApi = entitiesApi as any;

const renderPage = () => render(<MemoryRouter><AllocationsPage /></MemoryRouter>);

const mockAllocation = {
  id: 'a1',
  person_id: 'p1',
  person: { full_name: 'Alice' },
  entity_type: 'project',
  entity_id: 'proj-1',
  entity_name: 'Website Redesign',
  start_date: '2024-01-01',
  end_date: '2024-06-30',
  allocation_percentage: 80,
  status: 'active',
  notes: '',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
  mockEntitiesApi.list.mockResolvedValue({ data: [] });
});

describe('Given AllocationsPage loads successfully', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({ data: [mockAllocation] });
  });

  it('When the page loads / Then the page heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Allocations')).toBeInTheDocument());
  });

  it('When allocations are fetched / Then allocation entity names are rendered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website Redesign')).toBeInTheDocument());
  });

  it('When allocations are fetched / Then person name is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });
});

describe('Given AllocationsPage with no allocations', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
  });

  it('When the page loads / Then the empty state is displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No allocations')).toBeInTheDocument());
  });
});

describe('Given AllocationsPage filter interaction', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({ data: [mockAllocation] });
  });

  it('When status filter changes / Then API is called with new status', async () => {
    renderPage();
    await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'active' } });
    await waitFor(() =>
      expect(mockAllocApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))
    );
  });

  it('When entity type filter changes / Then API is called with new entity type', async () => {
    renderPage();
    await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All Entity Types'), { target: { value: 'project' } });
    await waitFor(() =>
      expect(mockAllocApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ entity_type: 'project' }))
    );
  });
});

describe('Given AllocationsPage create interaction', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({ data: [mockAllocation] });
  });

  it('When New Allocation is clicked / Then the create modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website Redesign')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Allocation'));
    await waitFor(() => expect(screen.getByText('Person *')).toBeInTheDocument());
  });
});

describe('Given the create allocation form is submitted', () => {
  const PERSON_UUID = '11111111-1111-4111-8111-111111111111';
  const ENTITY_UUID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockPeopleApi.getAll.mockResolvedValue({
      data: [{ id: PERSON_UUID, full_name: 'Alice', job_title: 'Dev', type: 'employee', cost_rate: 50, cost_rate_unit: 'hour' }],
    });
    mockEntitiesApi.list.mockResolvedValue({ data: [{ id: ENTITY_UUID, name: 'Website Redesign' }] });
    mockAllocApi.create.mockResolvedValue({ id: 'a-new' });
  });

  const openModal = async () => {
    const view = renderPage();
    await waitFor(() => expect(screen.getByText('No allocations')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Allocation'));
    await waitFor(() => expect(screen.getByRole('option', { name: /Alice/ })).toBeInTheDocument());
    return view;
  };

  const fillDates = (container: HTMLElement) => {
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-06-30' } });
  };

  // Open the entity dropdown and pick the loaded option (stores its real UUID).
  const pickEntity = async () => {
    fireEvent.click(screen.getByText('Select project...'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Website Redesign' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Website Redesign' }));
  };

  it('When no entity is selected / Then it shows a validation error and create is not called', async () => {
    const { container } = await openModal();
    fireEvent.change(screen.getByDisplayValue('Select a person...'), { target: { value: PERSON_UUID } });
    fillDates(container);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText(/Select an entity/)).toBeInTheDocument());
    expect(mockAllocApi.create).not.toHaveBeenCalled();
  });

  it('When percentage is out of range / Then it shows a validation error and create is not called', async () => {
    const { container } = await openModal();
    fireEvent.change(screen.getByDisplayValue('Select a person...'), { target: { value: PERSON_UUID } });
    await pickEntity();
    fillDates(container);
    const pctInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(pctInput, { target: { value: '150' } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText(/between 1 and 100/)).toBeInTheDocument());
    expect(mockAllocApi.create).not.toHaveBeenCalled();
  });

  it('When an entity is picked and percentage is valid / Then create is called with its UUID and numeric percentage', async () => {
    const { container } = await openModal();
    fireEvent.change(screen.getByDisplayValue('Select a person...'), { target: { value: PERSON_UUID } });
    await pickEntity();
    fillDates(container);
    const pctInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(pctInput, { target: { value: '60' } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(mockAllocApi.create).toHaveBeenCalledTimes(1));
    const payload = mockAllocApi.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      person_id: PERSON_UUID,
      entity_type: 'project',
      entity_id: ENTITY_UUID,
      entity_name: 'Website Redesign',
      allocation_percentage: 60,
    });
    expect(payload.allocation_percentage).toBe(60);
    expect('allocation_value' in payload).toBe(false);
  });
});
