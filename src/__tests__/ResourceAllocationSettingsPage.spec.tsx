import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/orgSettingsService', () => ({
  settingsApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true }),
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, onClick, disabled, type }: any) => (
    <button onClick={onClick} disabled={disabled} type={type}>{children}</button>
  ),
  toast: toastMock,
}));

import { settingsApi } from '../services/orgSettingsService';
import ResourceAllocationSettingsPage, {
  DEFAULT_RESOURCE_ALLOCATION_SETTINGS,
} from '../pages/settings/ResourceAllocationSettingsPage';

const mockApi = settingsApi as any;

const renderPage = () => render(<MemoryRouter><ResourceAllocationSettingsPage /></MemoryRouter>);

describe('Given ResourceAllocationSettingsPage wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('When mounted / Then it calls settingsApi.get with category "resource_allocation_defaults"', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'resource_allocation_defaults', value: {}, updated_by: null, updated_at: null });
    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('resource_allocation_defaults'));
  });

  it('When Save Changes is clicked / Then it calls settingsApi.update with category "resource_allocation_defaults" and the current value', async () => {
    mockApi.get.mockResolvedValueOnce({
      category: 'resource_allocation_defaults',
      value: DEFAULT_RESOURCE_ALLOCATION_SETTINGS,
      updated_by: null,
      updated_at: null,
    });
    mockApi.update.mockResolvedValueOnce({
      category: 'resource_allocation_defaults',
      value: DEFAULT_RESOURCE_ALLOCATION_SETTINGS,
      updated_by: 'u1',
      updated_at: 'now',
    });

    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() =>
      expect(mockApi.update).toHaveBeenCalledWith('resource_allocation_defaults', DEFAULT_RESOURCE_ALLOCATION_SETTINGS),
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Resource allocation settings saved'));
  });
});
