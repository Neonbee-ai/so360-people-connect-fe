import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
import PerformanceSettingsPage, { DEFAULT_PERFORMANCE_SETTINGS } from '../pages/settings/PerformanceSettingsPage';

const mockApi = settingsApi as any;

const renderPage = () => render(<MemoryRouter><PerformanceSettingsPage /></MemoryRouter>);

describe('Given PerformanceSettingsPage wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('When mounted / Then it calls settingsApi.get with category "performance_settings"', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'performance_settings', value: {}, updated_by: null, updated_at: null });
    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('performance_settings'));
  });

  it('When adding a KPI category tag / Then it appears in the tag list and is included on save', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'performance_settings', value: DEFAULT_PERFORMANCE_SETTINGS, updated_by: null, updated_at: null });
    mockApi.update.mockResolvedValueOnce({ category: 'performance_settings', value: {}, updated_by: 'u1', updated_at: 'now' });

    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());

    const kpiInput = screen.getByPlaceholderText('e.g. Quality of Work');
    fireEvent.change(kpiInput, { target: { value: 'Customer Satisfaction' } });
    const kpiFieldContainer = kpiInput.closest('div') as HTMLElement;
    fireEvent.click(within(kpiFieldContainer).getByText('Add'));

    expect(screen.getByText('Customer Satisfaction')).toBeTruthy();

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() =>
      expect(mockApi.update).toHaveBeenCalledWith('performance_settings', {
        ...DEFAULT_PERFORMANCE_SETTINGS,
        kpi_categories: ['Customer Satisfaction'],
      }),
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Performance settings saved'));
  });

  it('When mounted / Then it points to Review Templates for rating scale instead of duplicating it', async () => {
    mockApi.get.mockResolvedValueOnce({ category: 'performance_settings', value: {}, updated_by: null, updated_at: null });
    renderPage();

    await waitFor(() => expect(screen.getByRole('link', { name: /review templates/i })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /review templates/i })).toHaveAttribute('href', '/people/reviews/templates');
    expect(screen.queryByText(/^Rating Scale$/i)).not.toBeInTheDocument();
  });
});
