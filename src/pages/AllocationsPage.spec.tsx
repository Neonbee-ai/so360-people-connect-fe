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
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),

  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import AllocationsPage from './AllocationsPage';
import { allocationsApi, peopleApi } from '../services/peopleService';

const mockAllocApi = allocationsApi as any;
const mockPeopleApi = peopleApi as any;

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
  allocation_type: 'percentage',
  allocation_value: 80,
  allocation_period: 'daily',
  status: 'active',
  notes: '',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
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
