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
import NumberingSettingsPage, { DEFAULT_NUMBERING_SETTINGS } from '../pages/settings/NumberingSettingsPage';

const mockApi = settingsApi as any;

const renderPage = () => render(<MemoryRouter><NumberingSettingsPage /></MemoryRouter>);

describe('Given NumberingSettingsPage wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('When mounted / Then it calls settingsApi.get with category "numbering"', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'numbering', value: {}, updated_by: null, updated_at: null });
    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('numbering'));
  });

  it('When Save Changes is clicked / Then it calls settingsApi.update with category "numbering" and the current value', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'numbering', value: DEFAULT_NUMBERING_SETTINGS, updated_by: null, updated_at: null });
    mockApi.update.mockResolvedValueOnce({ category: 'numbering', value: DEFAULT_NUMBERING_SETTINGS, updated_by: 'u1', updated_at: 'now' });

    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith('numbering', DEFAULT_NUMBERING_SETTINGS));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Numbering settings saved'));
  });
});
