import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SettingsHubPage from '../pages/SettingsHubPage';
import { settingsNavItems } from '../config/settingsNav';

const renderHub = () => render(<MemoryRouter><SettingsHubPage /></MemoryRouter>);

describe('Given the Settings Hub nav config', () => {
  it('When settingsNavItems is inspected / Then it has exactly 20 entries (the full named catalog)', () => {
    expect(settingsNavItems).toHaveLength(20);
  });

  it('When settingsNavItems is inspected / Then every entry has key, label, path, and a valid status', () => {
    settingsNavItems.forEach((item) => {
      expect(item.key).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.path).toBeTruthy();
      expect(['active', 'coming_soon']).toContain(item.status);
    });
  });
});

describe('Given the Settings Hub page is rendered', () => {
  it('When rendered / Then all 20 section labels are shown', () => {
    renderHub();
    settingsNavItems.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it('When rendered / Then active items render as links to their configured path', () => {
    renderHub();
    const activeItems = settingsNavItems.filter((i) => i.status === 'active');
    activeItems.forEach((item) => {
      const link = screen.getByText(item.label).closest('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe(`/${item.path}`);
    });
  });

  it('When rendered / Then coming_soon items are not links and show a Coming soon badge', () => {
    renderHub();
    const comingSoonItems = settingsNavItems.filter((i) => i.status === 'coming_soon');
    expect(comingSoonItems.length).toBeGreaterThan(0);
    comingSoonItems.forEach((item) => {
      const label = screen.getByText(item.label);
      expect(label.closest('a')).toBeNull();
    });
    const badges = screen.getAllByText('Coming soon');
    expect(badges).toHaveLength(comingSoonItems.length);
  });

  it('When rendered / Then the Organization Settings item is active and points to settings/organization', () => {
    renderHub();
    const link = screen.getByText('Organization Settings').closest('a');
    expect(link?.getAttribute('href')).toBe('/settings/organization');
  });

  it('When rendered / Then the Attendance Settings item is active and points to settings/attendance', () => {
    renderHub();
    const link = screen.getByText('Attendance Settings').closest('a');
    expect(link?.getAttribute('href')).toBe('/settings/attendance');
  });

  it('When rendered / Then the Numbering & Prefixes item is active and points to settings/numbering', () => {
    renderHub();
    const link = screen.getByText('Numbering & Prefixes').closest('a');
    expect(link?.getAttribute('href')).toBe('/settings/numbering');
  });
});
