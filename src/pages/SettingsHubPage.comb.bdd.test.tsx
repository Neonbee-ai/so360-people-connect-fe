import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true }),
}));

vi.mock('@so360/design-system', async () => await import('../test/__mocks__/design-system'));

import SettingsHubPage from './SettingsHubPage';
import { settingsNavItems } from '../config/settingsNav';

const renderPage = () => render(<MemoryRouter><SettingsHubPage /></MemoryRouter>);

describe('Given SettingsHubPage built on Comb SettingsPageTemplate', () => {
  it('When the page renders / Then the "Settings" title and description are shown', () => {
    renderPage();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Configure People Connect for your organization.')).toBeInTheDocument();
  });

  it('When the page renders / Then the settings sections navigation is present', () => {
    renderPage();
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeInTheDocument();
  });

  it('When an item is active / Then it renders as a link to its route', () => {
    renderPage();
    const active = settingsNavItems.find((i) => i.status !== 'coming_soon')!;
    const link = screen.getByRole('link', { name: active.label });
    expect(link).toHaveAttribute('href', `/${active.path}`);
  });

  it('When no section is selected / Then the empty-state prompt is shown', () => {
    renderPage();
    expect(screen.getByText('Select a settings section from the left to get started.')).toBeInTheDocument();
  });

  it('When an item is coming soon / Then it is disabled and shows a "Coming soon" badge', () => {
    const soon = settingsNavItems.filter((i) => i.status === 'coming_soon');
    renderPage();
    if (soon.length === 0) {
      expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
      return;
    }
    expect(screen.getAllByText('Coming soon').length).toBe(soon.length);
    expect(screen.queryByRole('link', { name: soon[0].label })).not.toBeInTheDocument();
  });
});
