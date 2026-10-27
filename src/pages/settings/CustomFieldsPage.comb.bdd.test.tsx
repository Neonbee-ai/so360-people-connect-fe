import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/customFieldsService', () => ({
  customFieldDefsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  CHOICE_FIELD_TYPES: ['dropdown', 'multi_select'],
}));

const { flags } = vi.hoisted(() => ({ flags: { manage: true } }));
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: (k: string) => (k === 'action:people:employee_custom_fields:manage' ? flags.manage : true),
  }),
}));

const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@so360/design-system', async () => ({ ...(await import('../../test/__mocks__/design-system')), toast: toastMock }));

import { customFieldDefsApi } from '../../services/customFieldsService';
import CustomFieldsPage from './CustomFieldsPage';

const api = customFieldDefsApi as any;
const row = { id: 'f1', field_key: 'blood_group', label: 'Blood Group', field_type: 'text', options: [], is_required: false, is_active: true, sort_order: 0 };
const renderPage = () => render(<MemoryRouter><CustomFieldsPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  flags.manage = true;
});

describe('Given CustomFieldsPage built on Comb SettingsPageTemplate', () => {
  it('When fields load / Then the title, row label and Add Custom Field action are shown', async () => {
    api.getAll.mockResolvedValue({ data: [row] });
    renderPage();
    expect(await screen.findByText('Blood Group')).toBeInTheDocument();
    expect(screen.getByText('Employee Custom Fields')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add Custom Field/ }).length).toBeGreaterThan(0);
    expect(api.getAll).toHaveBeenCalledWith({ includeInactive: true });
  });

  it('When there are no fields / Then the empty state is shown', async () => {
    api.getAll.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText('No custom fields')).toBeInTheDocument();
  });

  it('When loading fails / Then the error state and an error toast are shown', async () => {
    api.getAll.mockRejectedValue(new Error('x'));
    renderPage();
    expect(await screen.findByText("Couldn't load custom fields")).toBeInTheDocument();
    expect(toastMock.error).toHaveBeenCalledWith('Failed to load custom fields');
  });

  it('When the manage flag is off / Then Add Custom Field and row actions are hidden', async () => {
    flags.manage = false;
    api.getAll.mockResolvedValue({ data: [row] });
    renderPage();
    await screen.findByText('Blood Group');
    expect(screen.queryByRole('button', { name: /Add Custom Field/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('When a new field is submitted / Then create is called with the label-derived key and sort order', async () => {
    api.getAll.mockResolvedValue({ data: [row] });
    api.create.mockResolvedValue({});
    renderPage();
    await screen.findByText('Blood Group');
    fireEvent.click(screen.getAllByRole('button', { name: /Add Custom Field/ })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(dialog.querySelector('input[name="label"]')!, { target: { value: 'Passport Expiry' } });
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Add Custom Field')!);
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ label: 'Passport Expiry', field_key: 'passport_expiry', sort_order: 1 })),
    );
  });

  it('When delete fails / Then an error toast is shown', async () => {
    api.getAll.mockResolvedValue({ data: [row] });
    api.delete.mockRejectedValue(new Error('Cannot delete'));
    renderPage();
    await screen.findByText('Blood Group');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Cannot delete'));
  });
});
