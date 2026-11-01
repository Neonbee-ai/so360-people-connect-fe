import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({ peopleApi: { getAll: vi.fn() } }));
vi.mock('../services/leaveTypesService', () => ({ leaveTypesApi: { getAll: vi.fn() }, LeaveType: {} }));
vi.mock('../services/leaveRequestsService', () => ({
  leaveBalancesApi: { getAll: vi.fn(), initialize: vi.fn(), adjust: vi.fn() },
  LeaveBalance: {},
}));

const flags = { adjust: true };
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: () => flags.adjust,
    hasPermission: () => true,
    currentTenant: { id: 't' },
    currentOrg: { id: 'o' },
  }),
}));

import LeaveBalancesPage from './LeaveBalancesPage';
import { peopleApi } from '../services/peopleService';
import { leaveTypesApi } from '../services/leaveTypesService';
import { leaveBalancesApi } from '../services/leaveRequestsService';
import { toast } from '@so360/design-system';

const people = peopleApi as any;
const types = leaveTypesApi as any;
const balances = leaveBalancesApi as any;

const renderPage = () => render(<MemoryRouter><LeaveBalancesPage /></MemoryRouter>);
const pick = async () => {
  await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());
  fireEvent.change(screen.getByDisplayValue('Select an employee...'), { target: { value: 'p1' } });
};

beforeEach(() => {
  vi.resetAllMocks();
  flags.adjust = true;
  people.getAll.mockResolvedValue({ data: [{ id: 'p1', full_name: 'Alice Johnson' }] });
  types.getAll.mockResolvedValue({ data: [{ id: 'lt1', name: 'Annual Leave', code: 'AL', is_active: true }] });
  balances.getAll.mockResolvedValue({ data: [] });
});

describe('LeaveBalancesPage (Comb)', () => {
  it('Given the page / When it loads / Then title and select-employee empty state show', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Leave Balances' })).toBeInTheDocument();
    expect(screen.getByText('Select an employee')).toBeInTheDocument();
  });

  it('Given an employee / When selected / Then balances are fetched for them', async () => {
    renderPage();
    await pick();
    await waitFor(() => expect(balances.getAll).toHaveBeenCalledWith(expect.objectContaining({ person_id: 'p1' })));
    expect(await screen.findByText('Not initialized')).toBeInTheDocument();
  });

  it('Given an employee / When Initialize is clicked / Then initialize API is called with person and year', async () => {
    balances.initialize.mockResolvedValue({});
    renderPage();
    await pick();
    fireEvent.click(screen.getByText('Initialize Balances'));
    await waitFor(() => expect(balances.initialize).toHaveBeenCalledWith(expect.objectContaining({ person_id: 'p1', fiscal_year: expect.any(Number) })));
  });

  it('Given the adjust flag is off / When rendered / Then Initialize is hidden', async () => {
    flags.adjust = false;
    renderPage();
    expect(screen.queryByText('Initialize Balances')).not.toBeInTheDocument();
  });

  it('Given the balances API fails / When an employee is selected / Then an error toast shows', async () => {
    balances.getAll.mockRejectedValue(new Error('x'));
    const spy = vi.spyOn(toast, 'error');
    renderPage();
    await pick();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load leave balances'));
  });
});
