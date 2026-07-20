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

// ─── Attendance (submodule:people:attendance flag) ────────────────────────────

describe('Given ModuleNav Attendance item', () => {
  it('When the attendance flag is enabled / Then Attendance is visible and points to /attendance', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
    renderNav();
    const link = screen.getByText('Attendance').closest('a');
    expect(link?.getAttribute('href')).toBe('/attendance');
  });

  it('When the attendance flag is disabled / Then Attendance is hidden', () => {
    mockShell = {
      effectiveFlagsLoaded: true,
      isFeatureEnabled: (key: string) => key !== 'submodule:people:attendance',
    };
    renderNav();
    expect(screen.queryByText('Attendance')).not.toBeInTheDocument();
  });

  it('When flags are not yet loaded / Then Attendance is hidden', () => {
    mockShell = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
    renderNav();
    expect(screen.queryByText('Attendance')).not.toBeInTheDocument();
  });
});

describe('Given ModuleNav Leave Types visibility', () => {
  it('When user is not admin / Then Leave Types is still visible (not adminOnly)', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: false };
    renderNav();
    expect(screen.getByText('Leave Types')).toBeInTheDocument();
  });

  it('When user is admin / Then Leave Types is visible', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav();
    expect(screen.getByText('Leave Types')).toBeInTheDocument();
  });

  it('When rendered / Then Leave Types link points to /leaves/types', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
    renderNav('/leaves/types');
    const link = screen.getByText('Leave Types').closest('a');
    expect(link?.getAttribute('href')).toBe('/leaves/types');
  });
});

describe('Given ModuleNav adminOnly filter', () => {
  it('When user is not admin / Then Review Templates is hidden', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: false };
    renderNav();
    expect(screen.queryByText('Review Templates')).not.toBeInTheDocument();
  });

  it('When user is admin / Then Review Templates is visible', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav();
    expect(screen.getByText('Review Templates')).toBeInTheDocument();
  });

  it('When isAdmin is undefined (bridge not yet loaded) / Then adminOnly items are hidden', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true };
    renderNav();
    expect(screen.queryByText('Review Templates')).not.toBeInTheDocument();
  });
});

// ─── Work Locations (adminOnly, no flagKey) ───────────────────────────────────

describe('Given ModuleNav Work Locations item', () => {
  it('When user is not admin / Then Work Locations is hidden', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: false };
    renderNav();
    expect(screen.queryByText('Work Locations')).not.toBeInTheDocument();
  });

  it('When user is admin / Then Work Locations is visible', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav();
    expect(screen.getByText('Work Locations')).toBeInTheDocument();
  });

  it('When user is admin / Then Work Locations link points to /settings/work-locations', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav('/settings/work-locations');
    const link = screen.getByText('Work Locations').closest('a');
    expect(link?.getAttribute('href')).toBe('/settings/work-locations');
  });
});

// ─── Hierarchy (adminOnly + submodule:people:approval_chains flag) ────────────

describe('Given ModuleNav Hierarchy item', () => {
  it('When user is not admin / Then Hierarchy is hidden regardless of flag', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: false };
    renderNav();
    expect(screen.queryByText('Hierarchy')).not.toBeInTheDocument();
  });

  it('When user is admin and flag is enabled / Then Hierarchy is visible', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav();
    expect(screen.getByText('Hierarchy')).toBeInTheDocument();
  });

  it('When user is admin but flag is disabled / Then Hierarchy is hidden', () => {
    mockShell = {
      effectiveFlagsLoaded: true,
      isFeatureEnabled: (key: string) => key !== 'submodule:people:approval_chains',
      isAdmin: true,
    };
    renderNav();
    expect(screen.queryByText('Hierarchy')).not.toBeInTheDocument();
  });

  it('When user is admin but flags are not yet loaded / Then Hierarchy is hidden', () => {
    mockShell = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true, isAdmin: true };
    renderNav();
    expect(screen.queryByText('Hierarchy')).not.toBeInTheDocument();
  });

  it('When user is admin and flag enabled / Then Hierarchy link points to /settings/approval-chains', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav('/settings/approval-chains');
    const link = screen.getByText('Hierarchy').closest('a');
    expect(link?.getAttribute('href')).toBe('/settings/approval-chains');
  });
});

// ─── Overtime Rules (adminOnly + submodule:people:employment_policy flag) ─────

describe('Given ModuleNav Overtime Rules item', () => {
  it('When user is not admin / Then Overtime Rules is hidden regardless of flag', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: false };
    renderNav();
    expect(screen.queryByText('Overtime Rules')).not.toBeInTheDocument();
  });

  it('When user is admin and flag is enabled / Then Overtime Rules is visible', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav();
    expect(screen.getByText('Overtime Rules')).toBeInTheDocument();
  });

  it('When user is admin but flag is disabled / Then Overtime Rules is hidden', () => {
    mockShell = {
      effectiveFlagsLoaded: true,
      isFeatureEnabled: (key: string) => key !== 'submodule:people:employment_policy',
      isAdmin: true,
    };
    renderNav();
    expect(screen.queryByText('Overtime Rules')).not.toBeInTheDocument();
  });

  it('When user is admin but flags are not yet loaded / Then Overtime Rules is hidden', () => {
    mockShell = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true, isAdmin: true };
    renderNav();
    expect(screen.queryByText('Overtime Rules')).not.toBeInTheDocument();
  });

  it('When user is admin and flag enabled / Then Overtime Rules link points to /settings/employment-policy', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav('/settings/employment-policy');
    const link = screen.getByText('Overtime Rules').closest('a');
    expect(link?.getAttribute('href')).toBe('/settings/employment-policy');
  });
});

// ─── Administration section collapses correctly ───────────────────────────────

describe('Given ModuleNav Administration section with all admin items hidden', () => {
  it('When user is not admin and no flagged items / Then Administration section is hidden entirely', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: false };
    renderNav();
    // Import/Export is not adminOnly — section still shows
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.queryByText('Work Locations')).not.toBeInTheDocument();
    expect(screen.queryByText('Hierarchy')).not.toBeInTheDocument();
    expect(screen.queryByText('Overtime Rules')).not.toBeInTheDocument();
  });

  it('When rendered / Then Events nav item is absent (events consolidated into Shell FE Activity Log)', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav();
    expect(screen.queryByText('Events')).not.toBeInTheDocument();
  });

  it('When user is admin / Then all three admin-only Administration items are visible together', () => {
    mockShell = { effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isAdmin: true };
    renderNav();
    expect(screen.getByText('Work Locations')).toBeInTheDocument();
    expect(screen.getByText('Hierarchy')).toBeInTheDocument();
    expect(screen.getByText('Overtime Rules')).toBeInTheDocument();
  });
});
