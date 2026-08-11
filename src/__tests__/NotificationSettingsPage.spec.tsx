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
import NotificationSettingsPage, { DEFAULT_NOTIFICATION_SETTINGS } from '../pages/settings/NotificationSettingsPage';

const mockApi = settingsApi as any;

const renderPage = () => render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);

describe('Given NotificationSettingsPage wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('When mounted / Then it calls settingsApi.get with category "notification_settings"', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'notification_settings', value: {}, updated_by: null, updated_at: null });
    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('notification_settings'));
  });

  it('When toggling a matrix cell and saving / Then the updated matrix is sent to settingsApi.update', async () => {
    mockApi.get.mockResolvedValueOnce({
      category: 'notification_settings',
      value: DEFAULT_NOTIFICATION_SETTINGS,
      updated_by: null,
      updated_at: null,
    });
    mockApi.update.mockResolvedValueOnce({ category: 'notification_settings', value: {}, updated_by: 'u1', updated_at: 'now' });

    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());

    const smsCheckbox = screen.getByLabelText('Leave Request via SMS') as HTMLInputElement;
    expect(smsCheckbox.checked).toBe(false);
    fireEvent.click(smsCheckbox);
    expect(smsCheckbox.checked).toBe(true);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(mockApi.update).toHaveBeenCalled());
    const sentValue = mockApi.update.mock.calls[0][1];
    expect(sentValue.matrix.leave_request.sms).toBe(true);
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Notification settings saved'));
  });
});
