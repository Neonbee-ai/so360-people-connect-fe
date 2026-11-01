import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/orgSettingsService', () => ({
  settingsApi: { get: vi.fn(), update: vi.fn() },
}));

const { flags } = vi.hoisted(() => ({ flags: { manage: true } }));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isFeatureEnabled: (key: string) => (key === 'action:people:settings:manage' ? flags.manage : true),
  }),
}));

const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@so360/design-system', async () => ({ ...(await import('../../test/__mocks__/design-system')), toast: toastMock }));

import { settingsApi } from '../../services/orgSettingsService';
import Page from './ResourceAllocationSettingsPage';

const api = settingsApi as any;
const renderPage = () => render(<MemoryRouter><Page /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  flags.manage = true;
});

describe('Given ResourceAllocationSettingsPage built on Comb SettingsPageTemplate', () => {
  it('When the page loads / Then the "Resource Allocation Defaults" title and Save Changes action are shown', async () => {
    api.get.mockResolvedValue({ category: 'resource_allocation_defaults', value: {}, updated_by: null, updated_at: null });
    renderPage();
    expect(await screen.findByText('Resource Allocation Defaults')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/ })).toBeInTheDocument();
  });

  it('When settings are still loading / Then a loading spinner is shown and Save is disabled', async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: 'Loading resource allocation settings...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/ })).toBeDisabled();
  });

  it('When the page mounts / Then it fetches the "resource_allocation_defaults" category', async () => {
    api.get.mockResolvedValue({ category: 'resource_allocation_defaults', value: {}, updated_by: null, updated_at: null });
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('resource_allocation_defaults'));
  });

  it('When Save Changes is clicked / Then settingsApi.update is called with the category and a success toast shows', async () => {
    api.get.mockResolvedValue({ category: 'resource_allocation_defaults', value: {}, updated_by: null, updated_at: null });
    api.update.mockResolvedValue({});
    renderPage();
    const save = await screen.findByRole('button', { name: /Save Changes/ });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('resource_allocation_defaults', expect.any(Object)));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Resource allocation settings saved'));
  });

  it('When the manage flag is off / Then the Save Changes action is hidden', async () => {
    flags.manage = false;
    api.get.mockResolvedValue({ category: 'resource_allocation_defaults', value: {}, updated_by: null, updated_at: null });
    renderPage();
    await screen.findByText('Resource Allocation Defaults');
    expect(screen.queryByRole('button', { name: /Save Changes/ })).not.toBeInTheDocument();
  });

  it('When loading fails / Then an error toast is shown', async () => {
    api.get.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Failed to load resource allocation settings'));
  });

  it('When saving fails / Then an error toast is shown', async () => {
    api.get.mockResolvedValue({ category: 'resource_allocation_defaults', value: {}, updated_by: null, updated_at: null });
    api.update.mockRejectedValue(new Error('boom'));
    renderPage();
    const save = await screen.findByRole('button', { name: /Save Changes/ });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Failed to save resource allocation settings'));
  });
});
