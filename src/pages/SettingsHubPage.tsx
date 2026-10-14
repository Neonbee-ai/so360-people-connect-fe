import React from 'react';
import { NavLink } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { settingsNavItems } from '../config/settingsNav';

// Landing page at /people/settings. A simple nav-rail index into every
// settings section — active items navigate to their existing top-level
// route (no nested <Outlet/> wrapping), so this page can ship without
// restructuring any settings route another group already owns.
const SettingsHubPage: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          Configure People Connect for your organization.
        </p>
      </div>

      <div className="flex gap-6">
        <nav className="w-72 shrink-0 bg-surface border border-line rounded-nb overflow-hidden" aria-label="Settings sections">
          <ul className="divide-y divide-line">
            {settingsNavItems.map((item) => {
              const isComingSoon = item.status === 'coming_soon';
              if (isComingSoon) {
                return (
                  <li key={item.key}>
                    <div
                      className="flex items-center justify-between px-4 py-3 text-sm text-fg-subtle cursor-not-allowed"
                      aria-disabled="true"
                      title="Coming soon"
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-surface-raised text-fg-subtle border border-line-strong">
                        Coming soon
                      </span>
                    </div>
                  </li>
                );
              }
              return (
                <li key={item.key}>
                  <NavLink
                    to={`/${item.path}`}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-4 py-3 text-sm transition-colors ${
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

        <div className="flex-1 min-w-0">
          <div className="flex flex-col items-center justify-center py-16 text-center text-fg-subtle border border-dashed border-line rounded-nb">
            <p className="text-sm">Select a settings section from the left to get started.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsHubPage;
