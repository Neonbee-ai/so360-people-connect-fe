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
        <h1 className="text-2xl font-bold text-slate-50 flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-500" />
          Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure People Connect for your organization.
        </p>
      </div>

      <div className="flex gap-6">
        <nav className="w-72 shrink-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" aria-label="Settings sections">
          <ul className="divide-y divide-slate-800">
            {settingsNavItems.map((item) => {
              const isComingSoon = item.status === 'coming_soon';
              if (isComingSoon) {
                return (
                  <li key={item.key}>
                    <div
                      className="flex items-center justify-between px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
                      aria-disabled="true"
                      title="Coming soon"
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
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
                          ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-600'
                          : 'text-slate-300 hover:text-slate-50 hover:bg-slate-800'
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
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            <p className="text-sm">Select a settings section from the left to get started.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsHubPage;
