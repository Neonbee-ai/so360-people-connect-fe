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

let mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ ...mockShellFlags, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));

import AllocationsPage from './AllocationsPage';
import { allocationsApi, peopleApi, entitiesApi } from '../services/peopleService';

const mockAllocApi = allocationsApi as any;
const mockPeopleApi = peopleApi as any;
const mockEntitiesApi = entitiesApi as any;

const renderPage = () =>
  render(<MemoryRouter><AllocationsPage /></MemoryRouter>);

const mockAllocation = {
  id: 'a1',
  person_id: 'p1',
  person: { full_name: 'Alice' },
  entity_type: 'project',
  entity_id: 'proj-1',
  entity_name: 'Website',
  start_date: '2026-01-01',
  end_date: '2026-06-30',
  allocation_value: 80,
  allocation_type: 'percentage',
  status: 'active',
  notes: '',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
  mockPeopleApi.getAll.mockResolvedValue({ data: [] });
  mockEntitiesApi.list.mockResolvedValue({ data: [] });
});

// ============================================================================
//   Loading and display
// ============================================================================
describe('AllocationsPage', () => {
  describe('Given allocations are loaded', () => {
    beforeEach(() => {
      mockAllocApi.getAll.mockResolvedValue({
        data: [
          { ...mockAllocation, id: 'a1', entity_name: 'Website', allocation_value: 80 },
          { ...mockAllocation, id: 'a2', entity_name: 'Mobile App', allocation_value: 40, entity_id: 'proj-2' },
        ],
      });
    });

    it('When the page loads / Then allocation cards are rendered', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
      expect(screen.getByText('Mobile App')).toBeInTheDocument();
    });

    it('When a person is overallocated / Then a warning is shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getAllByText(/120% allocated/).length).toBeGreaterThan(0));
    });

    it('When the status filter is changed / Then allocations are re-fetched', async () => {
      renderPage();
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalled());
      fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'active' } });
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' })));
    });

    it('When the summary stats are displayed / Then they count correctly', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('2 allocations')).toBeInTheDocument());
      expect(screen.getByText('2 active')).toBeInTheDocument();
    });
  });

  describe('Given the user interacts with allocations', () => {
    beforeEach(() => {
      mockAllocApi.getAll.mockResolvedValue({ data: [mockAllocation] });
    });

    it('When entity type filter is changed / Then allocations are re-fetched', async () => {
      renderPage();
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalled());
      fireEvent.change(screen.getByDisplayValue('All Entity Types'), { target: { value: 'project' } });
      await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalledWith(expect.objectContaining({ entity_type: 'project' })));
    });

    it('When New Allocation is clicked / Then the create modal opens', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
      fireEvent.click(screen.getByText('New Allocation'));
      await waitFor(() => expect(screen.getByText('Person *')).toBeInTheDocument());
    });
  });

  describe('Given no allocations exist', () => {
    beforeEach(() => {
      mockAllocApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then the empty state is shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('No allocations')).toBeInTheDocument());
    });
  });
});

// ============================================================================
//   Feature flag gate
// ============================================================================
describe('AllocationsPage — effectiveFlagsLoaded gate', () => {
  it('When effectiveFlagsLoaded is false / Then New Allocation button is absent', async () => {
    mockShellFlags = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No allocations')).toBeInTheDocument());
    expect(screen.queryByText('New Allocation')).not.toBeInTheDocument();
  });

  it('When effectiveFlagsLoaded is true / Then New Allocation button is present', async () => {
    mockShellFlags = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('No allocations')).toBeInTheDocument());
    expect(screen.getByText('New Allocation')).toBeInTheDocument();
  });
});

// ============================================================================
//   Edit allocation
// ============================================================================
describe('AllocationsPage — edit allocation', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({ data: [mockAllocation] });
  });

  it('When Edit button is clicked / Then the edit modal opens pre-filled with current allocation_value', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Edit'));
    await waitFor(() => expect(screen.getByText(/Edit Allocation/)).toBeInTheDocument());
    // The form should be pre-seeded with allocation.allocation_value (80)
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
  });

  it('When edit form is submitted with a new value / Then update API receives allocation_percentage (not allocation_value)', async () => {
    mockAllocApi.update.mockResolvedValue({ ...mockAllocation, allocation_value: 60 });
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Edit'));
    await waitFor(() => expect(screen.getByDisplayValue('80')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('80'), { target: { value: '60' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() =>
      expect(mockAllocApi.update).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ allocation_percentage: 60 }),
      ),
    );
    // Ensure the old DB column name is NOT sent
    const payload = mockAllocApi.update.mock.calls[0][1];
    expect('allocation_value' in payload).toBe(false);
  });

  it('When edit percentage is invalid / Then update is not called and error is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Edit'));
    await waitFor(() => expect(screen.getByDisplayValue('80')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('80'), { target: { value: '200' } });
    // Use fireEvent.submit on the form directly — same pattern as create validation tests
    const form = document.querySelector('form.space-y-4') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText(/between 1 and 100/)).toBeInTheDocument());
    expect(mockAllocApi.update).not.toHaveBeenCalled();
  });

  it('When edit modal is closed / Then the modal disappears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Edit'));
    await waitFor(() => expect(screen.getByText(/Edit Allocation/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText(/Edit Allocation/)).not.toBeInTheDocument());
  });
});

// ============================================================================
//   Cancel allocation
// ============================================================================
describe('AllocationsPage — cancel allocation', () => {
  beforeEach(() => {
    mockAllocApi.getAll.mockResolvedValue({ data: [mockAllocation] });
    mockAllocApi.cancel.mockResolvedValue({ message: 'cancelled successfully' });
  });

  it('When cancel button is clicked and user confirms / Then cancel API is called with the allocation ID', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Cancel'));
    await waitFor(() => expect(mockAllocApi.cancel).toHaveBeenCalledWith('a1'));
  });

  it('When cancel button is clicked but user dismisses the dialog / Then cancel API is NOT called', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Cancel'));
    expect(mockAllocApi.cancel).not.toHaveBeenCalled();
  });

  it('When cancel succeeds / Then the list is refreshed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Cancel'));
    await waitFor(() => expect(mockAllocApi.getAll).toHaveBeenCalledTimes(2));
  });
});

// ============================================================================
//   Allocations with terminal status hide action buttons
// ============================================================================
describe('AllocationsPage — terminal-status allocations', () => {
  it('When an allocation is cancelled / Then neither Edit nor Cancel buttons are rendered for it', async () => {
    mockAllocApi.getAll.mockResolvedValue({
      data: [{ ...mockAllocation, status: 'cancelled' }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Cancel')).not.toBeInTheDocument();
  });

  it('When an allocation is completed / Then neither Edit nor Cancel buttons are rendered for it', async () => {
    mockAllocApi.getAll.mockResolvedValue({
      data: [{ ...mockAllocation, status: 'completed' }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Cancel')).not.toBeInTheDocument();
  });
});

// ============================================================================
//   Error handling
// ============================================================================
describe('AllocationsPage — error handling', () => {
  it('When create API fails / Then the error is shown inline inside the modal and the modal stays open', async () => {
    mockAllocApi.getAll.mockResolvedValue({ data: [] });
    mockAllocApi.create.mockRejectedValue(new Error('Person already has an active allocation on this project.'));
    mockPeopleApi.getAll.mockResolvedValue({ data: [{ id: 'p1', full_name: 'Alice', job_title: 'Dev', type: 'employee', cost_rate: 50, cost_rate_unit: 'hour' }] });
    mockEntitiesApi.list.mockResolvedValue({ data: [{ id: '550e8400-e29b-41d4-a716-446655440000', name: 'Project X' }] });

    renderPage();
    await waitFor(() => expect(screen.getByText('No allocations')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Allocation'));
    await waitFor(() => expect(screen.getByRole('option', { name: /Alice/ })).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Select a person...'), { target: { value: 'p1' } });
    fireEvent.click(screen.getByText('Select project...'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Project X' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Project X' }));

    const container = document.querySelector('form')!;
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-06-30' } });
    fireEvent.submit(container);

    await waitFor(() =>
      expect(screen.getByText('Person already has an active allocation on this project.')).toBeInTheDocument(),
    );
    // Modal must still be visible so the user can correct the input
    expect(screen.getByText('Person *')).toBeInTheDocument();
  });

  it('When update API fails / Then an inline error is shown inside the edit modal', async () => {
    mockAllocApi.getAll.mockResolvedValue({ data: [mockAllocation] });
    mockAllocApi.update.mockRejectedValue(new Error('Update failed'));

    renderPage();
    await waitFor(() => expect(screen.getByText('Website')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Edit'));
    await waitFor(() => expect(screen.getByDisplayValue('80')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Update failed')).toBeInTheDocument());
    // Modal should still be open
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
  });

  it('When load fails / Then a failure toast is shown', async () => {
    mockAllocApi.getAll.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load allocations')).toBeInTheDocument());
  });
});

// ============================================================================
//   Unknown Person fallback
// ============================================================================
describe('AllocationsPage — person data', () => {
  it('When allocation has no person join / Then "Unknown Person" is displayed as a fallback', async () => {
    mockAllocApi.getAll.mockResolvedValue({
      data: [{ ...mockAllocation, person: null }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Unknown Person')).toBeInTheDocument());
  });

  it('When allocation has a person join / Then the person full_name is displayed', async () => {
    mockAllocApi.getAll.mockResolvedValue({ data: [mockAllocation] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.queryByText('Unknown Person')).not.toBeInTheDocument();
  });
});

// ============================================================================
//   Create form validation
// ============================================================================
describe('AllocationsPage — create form validation', () => {
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

  const pickEntity = async () => {
    fireEvent.click(screen.getByText('Select project...'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Website Redesign' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Website Redesign' }));
  };

  it('When no entity is selected / Then a validation error is shown and create is not called', async () => {
    const { container } = await openModal();
    fireEvent.change(screen.getByDisplayValue('Select a person...'), { target: { value: PERSON_UUID } });
    fillDates(container);
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(screen.getByText(/Select an entity/)).toBeInTheDocument());
    expect(mockAllocApi.create).not.toHaveBeenCalled();
  });

  it('When percentage is out of range / Then a validation error is shown and create is not called', async () => {
    const { container } = await openModal();
    fireEvent.change(screen.getByDisplayValue('Select a person...'), { target: { value: PERSON_UUID } });
    await pickEntity();
    fillDates(container);
    const pctInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(pctInput, { target: { value: '150' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(screen.getByText(/between 1 and 100/)).toBeInTheDocument());
    expect(mockAllocApi.create).not.toHaveBeenCalled();
  });

  it('When entity is picked and percentage is valid / Then create is called with UUID and numeric allocation_percentage (not allocation_value)', async () => {
    const { container } = await openModal();
    fireEvent.change(screen.getByDisplayValue('Select a person...'), { target: { value: PERSON_UUID } });
    await pickEntity();
    fillDates(container);
    const pctInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(pctInput, { target: { value: '60' } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(mockAllocApi.create).toHaveBeenCalledTimes(1));
    const payload = mockAllocApi.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      person_id: PERSON_UUID,
      entity_type: 'project',
      entity_id: ENTITY_UUID,
      entity_name: 'Website Redesign',
      allocation_percentage: 60,
    });
    // Must send allocation_percentage, never allocation_value
    expect(typeof payload.allocation_percentage).toBe('number');
    expect('allocation_value' in payload).toBe(false);
  });
});
