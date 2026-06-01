import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

let mockShell: Record<string, unknown> = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => mockShell,
}));

import ModuleNav from './ModuleNav';

beforeEach(() => {
  mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
});

const renderNav = (initialPath = '/dashboard') =>
  render(<MemoryRouter initialEntries={[initialPath]}><ModuleNav /></MemoryRouter>);

describe('Given ModuleNav is rendered', () => {
  it('When rendered / Then it shows the Overview section', () => {
    renderNav();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('When rendered / Then it shows People & Organization section', () => {
    renderNav();
    expect(screen.getByText('People & Organization')).toBeInTheDocument();
  });

  it('When rendered / Then it shows Resource Management section', () => {
    renderNav();
    expect(screen.getByText('Resource Management')).toBeInTheDocument();
  });

  it('When rendered / Then it shows Leave Management section', () => {
    renderNav();
    expect(screen.getByText('Leave Management')).toBeInTheDocument();
  });

  it('When rendered / Then it shows Performance section', () => {
    renderNav();
    expect(screen.getByText('Performance')).toBeInTheDocument();
  });

  it('When rendered / Then it shows Administration section', () => {
    renderNav();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });
});

describe('Given ModuleNav with nav items', () => {
  it('When rendered / Then Dashboard link is visible', () => {
    renderNav('/dashboard');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('When rendered / Then People Registry link is visible', () => {
    renderNav('/people');
    expect(screen.getByText('People Registry')).toBeInTheDocument();
  });

  it('When rendered / Then Departments link is visible', () => {
    renderNav();
    expect(screen.getByText('Departments')).toBeInTheDocument();
  });

  it('When rendered / Then Leave Requests link is visible', () => {
    renderNav();
    expect(screen.getByText('Leave Requests')).toBeInTheDocument();
  });

  it('When rendered / Then Import/Export link is visible', () => {
    renderNav();
    expect(screen.getByText('Import/Export')).toBeInTheDocument();
  });
});

describe('Given ModuleNav on a specific route', () => {
  it('When on the /people route / Then People Registry link has active styling', () => {
    renderNav('/people');
    const link = screen.getByText('People Registry').closest('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/people');
  });
});

describe('Given ModuleNav effectiveFlagsLoaded gate', () => {
  it('When effectiveFlagsLoaded is false / Then flagged nav items are hidden', () => {
    mockShell = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
    renderNav();
    expect(screen.queryByText('Allocations')).not.toBeInTheDocument();
    expect(screen.queryByText('Utilization')).not.toBeInTheDocument();
    expect(screen.queryByText('Reviews')).not.toBeInTheDocument();
  });

  it('When effectiveFlagsLoaded is true / Then flagged nav items are visible', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
    renderNav();
    expect(screen.getByText('Allocations')).toBeInTheDocument();
    expect(screen.getByText('Utilization')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
  });
});
