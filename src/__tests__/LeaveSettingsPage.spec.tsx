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
import LeaveSettingsPage, { DEFAULT_LEAVE_SETTINGS } from '../pages/settings/LeaveSettingsPage';

const mockApi = settingsApi as any;

const renderPage = () => render(<MemoryRouter><LeaveSettingsPage /></MemoryRouter>);

describe('Given LeaveSettingsPage wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('When mounted / Then it calls settingsApi.get with category "leave_policy"', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'leave_policy', value: {}, updated_by: null, updated_at: null });
    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('leave_policy'));
  });

  it('When stored values exist / Then the form reflects the loaded value', async () => {
    mockApi.get.mockResolvedValueOnce({
      category: 'leave_policy',
      value: { ...DEFAULT_LEAVE_SETTINGS, leave_year_start_month: 'April' },
      updated_by: null,
      updated_at: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('April')).toBeTruthy());
  });

  it('When mounted / Then it points to Leave Types for per-type accrual and carry-forward instead of duplicating them', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'leave_policy', value: {}, updated_by: null, updated_at: null });
    renderPage();

    await waitFor(() => expect(screen.getByRole('link', { name: /leave types/i })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /leave types/i })).toHaveAttribute('href', '/people/leaves/types');
    expect(screen.queryByText(/^Leave Accrual$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Auto Carry Forward/i)).not.toBeInTheDocument();
  });

  it('When Save Changes is clicked / Then it calls settingsApi.update with category "leave_policy" and the current value', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'leave_policy', value: DEFAULT_LEAVE_SETTINGS, updated_by: null, updated_at: null });
    mockApi.update.mockResolvedValueOnce({ category: 'leave_policy', value: DEFAULT_LEAVE_SETTINGS, updated_by: 'u1', updated_at: 'now' });

    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith('leave_policy', DEFAULT_LEAVE_SETTINGS));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Leave settings saved'));
  });
});
