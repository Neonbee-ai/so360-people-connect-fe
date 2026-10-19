/**
 * BDD specs - EmploymentTypesPage leave-types modal on Comb.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, isFeatureEnabled: () => true }),
}));
vi.mock('../../services/mastersService', () => ({
  mastersApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../services/leaveTypesService', () => ({ leaveTypesApi: { getAll: vi.fn() } }));
vi.mock('../../services/leaveConfigService', () => ({
  leaveConfigApi: { getForEmploymentType: vi.fn(), setForEmploymentType: vi.fn() },
}));

import EmploymentTypesPage from './EmploymentTypesPage';
import { mastersApi } from '../../services/mastersService';
import { leaveTypesApi } from '../../services/leaveTypesService';
import { leaveConfigApi } from '../../services/leaveConfigService';

const masters = mastersApi as any;
const types = leaveTypesApi as any;
const cfg = leaveConfigApi as any;

beforeEach(() => {
  vi.resetAllMocks();
  masters.getAll.mockResolvedValue({ data: [{ id: 'e1', name: 'Contract', is_active: true }] });
  types.getAll.mockResolvedValue({ data: [
    { id: 'l1', name: 'Annual', is_paid: true, max_days_per_year: 20 },
    { id: 'l2', name: 'Unpaid', is_paid: false, max_days_per_year: null },
  ] });
  cfg.getForEmploymentType.mockResolvedValue({ configured: true, leave_types: [{ id: 'l1' }] });
  cfg.setForEmploymentType.mockResolvedValue(undefined);
});

const open = async () => {
  render(<EmploymentTypesPage />);
  fireEvent.click(await screen.findByLabelText('Configure leave types for Contract'));
};

describe('EmploymentTypesPage leave-types modal (Comb)', () => {
  it('Given an employment type / When configure is clicked / Then the modal lists leave types', async () => {
    await open();
    expect(await screen.findByText('Annual')).toBeInTheDocument();
    expect(screen.getByText('Paid · 20 days/yr')).toBeInTheDocument();
  });

  it('Given the modal / When one type is preselected / Then its checkbox is checked', async () => {
    await open();
    await screen.findByText('Annual');
    expect((screen.getByLabelText('Annual') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Unpaid') as HTMLInputElement).checked).toBe(false);
  });

  it('Given a changed selection / When Save is clicked / Then the selected ids are sent', async () => {
    await open();
    await screen.findByText('Annual');
    fireEvent.click(screen.getByLabelText('Unpaid'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(cfg.setForEmploymentType).toHaveBeenCalledWith('e1', ['l1', 'l2']));
  });

  it('Given Clear selection / When clicked / Then the unconfigured warning appears', async () => {
    await open();
    await screen.findByText('Annual');
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByText(/resets this employment type to unconfigured/)).toBeInTheDocument();
  });

  it('Given a failing save / When Save is clicked / Then the error is shown and selection kept', async () => {
    cfg.setForEmploymentType.mockRejectedValue(new Error('x'));
    await open();
    await screen.findByText('Annual');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  });

  it('Given the catalog fails to load / When opened / Then a load error shows', async () => {
    types.getAll.mockRejectedValue(new Error('x'));
    await open();
    expect(await screen.findByText('Could not load leave types.')).toBeInTheDocument();
  });
});
