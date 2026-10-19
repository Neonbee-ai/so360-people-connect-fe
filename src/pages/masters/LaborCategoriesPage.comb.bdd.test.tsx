/**
 * BDD specs - LaborCategoriesPage on Comb (ListPageTemplate + DataTable + Modal).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const flags = { create: true };
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, isFeatureEnabled: () => flags.create }),
}));
vi.mock('../../services/laborCategoriesService', () => ({
  laborCategoriesApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

import LaborCategoriesPage from './LaborCategoriesPage';
import { laborCategoriesApi } from '../../services/laborCategoriesService';
import { toast } from '@so360/design-system';

const api = laborCategoriesApi as any;
const cat = (o: Record<string, any> = {}) => ({
  id: 'c1', org_id: 'o', tenant_id: 't', name: 'Welder', code: 'WLD', base_hourly_rate: 20, overtime_multiplier: 1.5, is_active: true, ...o,
});

let errSpy: any;
beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  flags.create = true;
  errSpy = vi.spyOn(toast, 'error');
  api.getAll.mockResolvedValue([cat()]);
  api.create.mockResolvedValue(cat());
  api.update.mockResolvedValue(cat());
  api.remove.mockResolvedValue({ success: true });
});

describe('LaborCategoriesPage (Comb)', () => {
  it('Given categories / When loaded / Then title, row and primary action show', async () => {
    render(<LaborCategoriesPage />);
    expect(await screen.findByText('Welder')).toBeInTheDocument();
    expect(screen.getByText('Labor Categories')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Labor Category/ })).toBeInTheDocument();
    expect(screen.getByText('20.00')).toBeInTheDocument();
  });

  it('Given none exist / When loaded / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue([]);
    render(<LaborCategoriesPage />);
    expect(await screen.findByText('No labor categories')).toBeInTheDocument();
  });

  it('Given an unpriced active category / When loaded / Then a Rates not set alert and Not set cell show', async () => {
    api.getAll.mockResolvedValue([cat({ base_hourly_rate: 0 })]);
    render(<LaborCategoriesPage />);
    expect(await screen.findByText('Rates not set')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('Given the create flag is off / When loaded / Then manage controls are hidden', async () => {
    flags.create = false;
    render(<LaborCategoriesPage />);
    await screen.findByText('Welder');
    expect(screen.queryByRole('button', { name: /Add Labor Category/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Edit Welder')).not.toBeInTheDocument();
  });

  it('Given the add form / When submitted / Then create receives the typed payload', async () => {
    render(<LaborCategoriesPage />);
    await screen.findByText('Welder');
    fireEvent.click(screen.getByRole('button', { name: /Add Labor Category/ }));
    fireEvent.change(await screen.findByLabelText('Name *'), { target: { value: 'Rigger' } });
    fireEvent.change(screen.getByLabelText('Code *'), { target: { value: 'RIG' } });
    fireEvent.change(screen.getByLabelText('Hourly Rate'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rigger', code: 'RIG', base_hourly_rate: 30 })),
    );
  });

  it('Given a row / When deactivated / Then update sends is_active false', async () => {
    render(<LaborCategoriesPage />);
    await screen.findByText('Welder');
    fireEvent.click(screen.getByLabelText('Deactivate'));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('c1', { is_active: false }));
  });

  it('Given a delete the backend refuses / When clicked / Then the backend message is toasted', async () => {
    api.remove.mockRejectedValue(new Error('In use by 3 time entries'));
    render(<LaborCategoriesPage />);
    await screen.findByText('Welder');
    fireEvent.click(screen.getByLabelText('Delete Welder'));
    await waitFor(() => expect(errSpy).toHaveBeenCalled());
  });
});
