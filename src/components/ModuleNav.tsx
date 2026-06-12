import React from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useShellBridge } from '@so360/shell-context';
import {
    LayoutDashboard,
    Users,
    Building2,
    Calendar,
    Clock,
    Activity,
    CalendarDays,
    CalendarRange,
    CheckCircle,
    TrendingUp,
    Target,
    FileText,
    Upload,
    Settings,
} from 'lucide-react';

interface NavItem {
    path: string;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    adminOnly?: boolean;
    flagKey?: string;
}

interface NavSection {
    section: string;
    items: NavItem[];
}

const navigationItems: NavSection[] = [
    {
        section: 'Overview',
        items: [
            { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ]
    },
    {
        section: 'People & Organization',
        items: [
            { path: '/people', label: 'People Registry', icon: Users },
            { path: '/departments', label: 'Departments', icon: Building2 },
        ]
    },
    {
        section: 'Resource Management',
        items: [
            { path: '/allocations', label: 'Allocations', icon: Calendar, flagKey: 'submodule:people:allocations' },
            { path: '/time', label: 'Employee Timesheets', icon: Clock },
            { path: '/utilization', label: 'Utilization', icon: Activity, flagKey: 'submodule:people:utilization' },
        ]
    },
    {
        section: 'Leave Management',
        items: [
            { path: '/leaves/requests', label: 'Leave Requests', icon: CalendarDays },
            { path: '/leaves/calendar', label: 'Leave Calendar', icon: CalendarRange },
            { path: '/leaves/approvals', label: 'Pending Approvals', icon: CheckCircle },
            { path: '/leaves/types', label: 'Leave Types', icon: Settings, adminOnly: true },
        ]
    },
    {
        section: 'Performance',
        items: [
            { path: '/reviews', label: 'Reviews', icon: TrendingUp, flagKey: 'submodule:people:reviews' },
            { path: '/goals', label: 'Goals', icon: Target },
            { path: '/team-performance', label: 'Team Performance', icon: Users },
            { path: '/reviews/templates', label: 'Review Templates', icon: FileText, adminOnly: true, flagKey: 'submodule:people:reviews' },
        ]
    },
    {
        section: 'Administration',
        items: [
            { path: '/import-export', label: 'Import/Export', icon: Upload },
            { path: '/events', label: 'Events', icon: Activity },
        ]
    },
];

const ModuleNav: React.FC = () => {
    const location = useLocation();
    const shell = useShellBridge();

    const isActive = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="h-full w-64 bg-slate-900 border-r border-slate-800 overflow-y-auto">
            <div className="p-6 space-y-6">
                {navigationItems.map((section) => {
                    const visibleItems = section.items.filter(
                        (item) => !item.flagKey || ((shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.(item.flagKey) ?? true))
                    );
                    if (visibleItems.length === 0) return null;
                    return (
                    <div key={section.section}>
                        <h3 className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                            {section.section}
                        </h3>
                        <div className="space-y-1">
                            {visibleItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive: navIsActive }) =>
                                            `flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                                                navIsActive
                                                    ? 'bg-teal-500/10 text-teal-400 border-l-2 border-teal-500'
                                                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-800'
                                            }`
                                        }
                                    >
                                        <Icon size={18} />
                                        <span>{item.label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                    );
                })}
            </div>
        </nav>
    );
};

export default ModuleNav;
