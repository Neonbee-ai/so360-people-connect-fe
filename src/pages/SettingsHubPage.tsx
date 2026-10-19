import React from 'react';
import { NavLink } from 'react-router-dom';
import { Badge, EmptyState, Grid, GridItem, SettingsPageTemplate } from '@so360/design-system';
import { settingsNavItems } from '../config/settingsNav';

// Landing page at /people/settings. A simple nav-rail index into every
// settings section — active items navigate to their existing top-level
// route (no nested <Outlet/> wrapping), so this page can ship without
// restructuring any settings route another group already owns.
const SettingsHubPage: React.FC = () => {
  return (
    <SettingsPageTemplate
      title="Settings"
      description="Configure People Connect for your organization."
    >
      <Grid gap="lg">
        <GridItem span={{ base: 'full', lg: 4 }}>
          <nav className="bg-surface border border-line rounded-nb overflow-hidden" aria-label="Settings sections">
            <ul className="divide-y divide-line">
              {settingsNavItems.map((item) => {
                const isComingSoon = item.status === 'coming_soon';
                if (isComingSoon) {
                  return (
                    <li key={item.key}>
                      <div
                        className="flex items-center justify-between px-nb-4 py-nb-3 text-nb-body text-fg-subtle cursor-not-allowed"
                        aria-disabled="true"
                        title="Coming soon"
                      >
                        <span>{item.label}</span>
                        <Badge tone="neutral" size="sm">Coming soon</Badge>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={item.key}>
                    <NavLink
                      to={`/${item.path}`}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-nb-4 py-nb-3 text-nb-body transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary border-l-2 border-primary'
                            : 'text-fg hover:text-fg hover:bg-surface-raised'
                        }`
                      }
                    >
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </GridItem>
        <GridItem span={{ base: 'full', lg: 8 }}>
          <EmptyState title="Select a settings section from the left to get started." />
        </GridItem>
      </Grid>
    </SettingsPageTemplate>
  );
};

export default SettingsHubPage;
