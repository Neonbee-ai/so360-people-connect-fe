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
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true }),
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
import UtilizationSettingsPage, { DEFAULT_UTILIZATION_SETTINGS } from '../pages/settings/UtilizationSettingsPage';

const mockApi = settingsApi as any;

const renderPage = () => render(<MemoryRouter><UtilizationSettingsPage /></MemoryRouter>);

describe('Given UtilizationSettingsPage wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('When mounted / Then it calls settingsApi.get with category "utilization_settings"', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'utilization_settings', value: {}, updated_by: null, updated_at: null });
    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('utilization_settings'));
  });

  it('When Save Changes is clicked / Then it calls settingsApi.update with category "utilization_settings" and the current value', async () => {
    mockApi.get.mockResolvedValueOnce({
      category: 'utilization_settings',
      value: DEFAULT_UTILIZATION_SETTINGS,
      updated_by: null,
      updated_at: null,
    });
    mockApi.update.mockResolvedValueOnce({
      category: 'utilization_settings',
      value: DEFAULT_UTILIZATION_SETTINGS,
      updated_by: 'u1',
      updated_at: 'now',
    });

    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith('utilization_settings', DEFAULT_UTILIZATION_SETTINGS));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Utilization settings saved'));
  });
});
