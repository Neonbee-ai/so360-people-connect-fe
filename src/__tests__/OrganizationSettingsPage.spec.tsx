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
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: () => true,
  }),
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
import OrganizationSettingsPage, { DEFAULT_ORGANIZATION_SETTINGS } from '../pages/settings/OrganizationSettingsPage';

const mockApi = settingsApi as any;

const renderPage = () => render(<MemoryRouter><OrganizationSettingsPage /></MemoryRouter>);

describe('Given OrganizationSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Given the page mounts', () => {
    it('When mounted / Then it calls settingsApi.get with category "organization" and pre-fills the form', async () => {
      mockApi.get.mockResolvedValueOnce({
        category: 'organization',
        value: { default_working_hours: 9, timezone: 'America/New_York' },
        updated_by: null,
        updated_at: null,
      });

      renderPage();

      await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('organization'));
      await waitFor(() => expect(screen.getByDisplayValue('9')).toBeInTheDocument());
      expect(screen.getByDisplayValue('America/New_York')).toBeInTheDocument();
    });

    it('When the stored value is empty / Then it falls back to sensible defaults', async () => {
      mockApi.get.mockResolvedValueOnce({ category: 'organization', value: {}, updated_by: null, updated_at: null });

      renderPage();

      await waitFor(() =>
        expect(screen.getAllByDisplayValue(String(DEFAULT_ORGANIZATION_SETTINGS.default_working_hours)).length).toBeGreaterThan(0),
      );
      expect(screen.getByDisplayValue(DEFAULT_ORGANIZATION_SETTINGS.timezone)).toBeInTheDocument();
      expect(screen.getByDisplayValue(DEFAULT_ORGANIZATION_SETTINGS.employee_id_format)).toBeInTheDocument();
    });
  });

  describe('Given the user clicks Save', () => {
    it('When Save Changes is clicked / Then it calls settingsApi.update with category and the current form value, then toasts success', async () => {
      mockApi.get.mockResolvedValueOnce({
        category: 'organization',
        value: { ...DEFAULT_ORGANIZATION_SETTINGS, default_working_hours: 7 },
        updated_by: null,
        updated_at: null,
      });
      mockApi.update.mockResolvedValueOnce({
        category: 'organization',
        value: { ...DEFAULT_ORGANIZATION_SETTINGS, default_working_hours: 7 },
        updated_by: 'user-1',
        updated_at: '2026-08-11T00:00:00Z',
      });

      renderPage();

      await waitFor(() => expect(screen.getByDisplayValue('7')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() =>
        expect(mockApi.update).toHaveBeenCalledWith('organization', { ...DEFAULT_ORGANIZATION_SETTINGS, default_working_hours: 7 }),
      );
      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Organization settings saved'));
    });

    it('When the save call fails / Then it toasts an error', async () => {
      mockApi.get.mockResolvedValueOnce({ category: 'organization', value: {}, updated_by: null, updated_at: null });
      mockApi.update.mockRejectedValueOnce(new Error('network error'));

      renderPage();

      await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Failed to save organization settings'));
    });
  });
});
