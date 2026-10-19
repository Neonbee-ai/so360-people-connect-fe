/**
 * BDD specs - MasterListPage on Comb (ListPageTemplate + DataTable).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const shellState = { canManage: true };
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true,
    hasPermission: () => true,
    isFeatureEnabled: () => shellState.canManage,
  }),
}));

vi.mock('../services/mastersService', () => ({
  mastersApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

import MasterListPage from './MasterListPage';
import { mastersApi } from '../services/mastersService';
import { toast } from '@so360/design-system';

const api = mastersApi as any;
const row = (o: Record<string, any> = {}) => ({ id: 'm1', name: 'Full Time', is_active: true, ...o });

let errSpy: any;
beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  errSpy = vi.spyOn(toast, 'error');
  shellState.canManage = true;
  api.getAll.mockResolvedValue({ data: [row()] });
  api.create.mockResolvedValue(row());
  api.update.mockResolvedValue(row());
  api.delete.mockResolvedValue({ message: 'Deleted' });
});

describe('MasterListPage (Comb)', () => {
  it('Given a master list / When it loads / Then the title, rows and primary action render', async () => {
    render(<MasterListPage masterType={'employment_type' as any} label="Employment Type" />);
    expect(await screen.findByText('Full Time')).toBeInTheDocument();
    expect(screen.getByText('Employment Types')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Employment Type/ })).toBeInTheDocument();
    expect(api.getAll).toHaveBeenCalledWith('employment_type', { includeInactive: true });
  });

  it('Given no rows / When loaded / Then the empty state offers to add the first one', async () => {
    api.getAll.mockResolvedValue({ data: [] });
    render(<MasterListPage masterType={'employment_type' as any} label="Employment Type" />);
    expect(await screen.findByText('No employment types')).toBeInTheDocument();
  });

  it('Given the load fails / When rendered / Then an error toast and error empty state show', async () => {
    api.getAll.mockRejectedValue(new Error('boom'));
    render(<MasterListPage masterType={'employment_type' as any} label="Employment Type" />);
    expect(await screen.findByText("Couldn't load employment types")).toBeInTheDocument();
    expect(errSpy).toHaveBeenCalledWith('Failed to load employment types');
  });

  it('Given the create flag is off / When rendered / Then add and row actions are hidden', async () => {
    shellState.canManage = false;
    render(<MasterListPage masterType={'employment_type' as any} label="Employment Type" />);
    await screen.findByText('Full Time');
    expect(screen.queryByRole('button', { name: /Add Employment Type/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('Given a manager / When the add form is submitted / Then create is called with the payload', async () => {
    render(<MasterListPage masterType={'employment_type' as any} label="Employment Type" />);
    await screen.findByText('Full Time');
    fireEvent.click(screen.getByRole('button', { name: /Add Employment Type/ }));
    const input = await screen.findByLabelText(/Name/);
    fireEvent.change(input, { target: { value: 'Contract' } });
    fireEvent.click(screen.getByRole('button', { name: /Create|Save/ }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith('employment_type', expect.objectContaining({ name: 'Contract' })),
    );
  });

  it('Given a row / When the active switch is toggled / Then update sends is_active false', async () => {
    render(<MasterListPage masterType={'employment_type' as any} label="Employment Type" />);
    await screen.findByText('Full Time');
    fireEvent.click(screen.getByLabelText('Deactivate'));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('employment_type', 'm1', { is_active: false }));
  });

  it('Given a row / When Delete fails / Then an error toast shows', async () => {
    api.delete.mockRejectedValue(new Error('no'));
    render(<MasterListPage masterType={'employment_type' as any} label="Employment Type" />);
    await screen.findByText('Full Time');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(errSpy).toHaveBeenCalledWith('Failed to delete employment type'));
  });
});
