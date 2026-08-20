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
    ClipboardCheck,
    DollarSign,
    Award,
    Briefcase,
    Sparkles,
    UserCheck,
    MapPin,
} from 'lucide-react';

interface NavItem {
    path: string;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    adminOnly?: boolean;
    flagKey?: string;
    /**
     * Role-permission gate, matching the route's PermissionGuard code. Opt-in
     * per item: the menu should never advertise a page whose guard will refuse
     * the click. Items stay visible while permissions load (no empty-nav
     * flash); once loaded, missing the code hides the item.
     */
    permKey?: string;
}

interface NavSection {
    section: string;
    items: NavItem[];
}

const navigationItems: NavSection[] = [
    {
        // Employee self-service — the landing surface for everyone without
        // workforce permissions. Plan-gated as one feature; the pages inside
        // degrade per-domain via the /me endpoints' own flags.
        section: 'My Work',
        items: [
            { path: '/my', label: 'My Work', icon: LayoutDashboard, flagKey: 'submodule:people:self_service' },
            { path: '/my/time', label: 'My Time', icon: Clock, flagKey: 'submodule:people:self_service' },
            { path: '/my/leave', label: 'My Leave', icon: CalendarDays, flagKey: 'submodule:people:self_service' },
            { path: '/my/goals', label: 'My Goals', icon: Target, flagKey: 'submodule:people:self_service' },
            { path: '/my/team', label: 'My Team', icon: Users, flagKey: 'submodule:people:self_service' },
            { path: '/my/profile', label: 'My Profile', icon: UserCheck, flagKey: 'submodule:people:self_service' },
        ]
    },
    {
        section: 'Overview',
        items: [
            // The workforce overview is an empty page without employees.read —
            // don't advertise it to people whose role can't populate it.
            { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permKey: 'employees.read' },
        ]
    },
    {
        section: 'People & Organization',
        items: [
            { path: '/people', label: 'People Registry', icon: Users },
            { path: '/departments', label: 'Departments', icon: Building2 },
            { path: '/settings/work-locations', label: 'Work Locations', icon: MapPin, adminOnly: true },
        ]
    },
    {
        section: 'Resource Management',
        items: [
            // permKeys mirror each route's PermissionGuard — the section only
            // renders for roles whose clicks the guards would actually admit.
            { path: '/allocations', label: 'Allocations', icon: Calendar, flagKey: 'submodule:people:allocations', permKey: 'allocations.read' },
            { path: '/attendance', label: 'Attendance', icon: ClipboardCheck, flagKey: 'submodule:people:attendance', permKey: 'attendance.read' },
            { path: '/time', label: 'Employee Timesheets', icon: Clock, permKey: 'attendance.read' },
            { path: '/utilization', label: 'Utilization', icon: Activity, flagKey: 'submodule:people:utilization', permKey: 'utilization.read' },
        ]
    },
    {
        section: 'Leave Management',
        items: [
            { path: '/leaves/requests', label: 'Leave Requests', icon: CalendarDays },
            { path: '/leaves/calendar', label: 'Leave Calendar', icon: CalendarRange },
            { path: '/leaves/approvals', label: 'Pending Approvals', icon: CheckCircle },
            { path: '/leaves/types', label: 'Leave Types', icon: Settings },
            { path: '/leaves/balances', label: 'Leave Balances', icon: DollarSign, adminOnly: true },
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
            { path: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
            { path: '/settings/approval-chains', label: 'Hierarchy', icon: Building2, adminOnly: true, flagKey: 'submodule:people:approval_chains' },
            { path: '/settings/employment-policy', label: 'Overtime Rules', icon: TrendingUp, adminOnly: true, flagKey: 'submodule:people:employment_policy' },
            // Master Data — Designations, Employment Types, Skills, Employee Status, Document Types.
            { path: '/settings/designations', label: 'Designations', icon: Award, adminOnly: true, flagKey: 'submodule:people:masters' },
            { path: '/settings/employment-types', label: 'Employment Types', icon: Briefcase, adminOnly: true, flagKey: 'submodule:people:masters' },
            { path: '/settings/skills', label: 'Skills', icon: Sparkles, adminOnly: true, flagKey: 'submodule:people:masters' },
            { path: '/settings/employee-status', label: 'Employee Status', icon: UserCheck, adminOnly: true, flagKey: 'submodule:people:masters' },
            { path: '/settings/document-types', label: 'Document Types', icon: FileText, adminOnly: true, flagKey: 'submodule:people:masters' },
        ]
    },
];

const ModuleNav: React.FC = () => {
    const location = useLocation();
    const shell = useShellBridge();
    const isAdmin = (shell as any)?.isAdmin ?? false;

    const isActive = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="h-full w-64 bg-slate-900 border-r border-slate-800 overflow-y-auto">
            <div className="p-6 space-y-6">
                {navigationItems.map((section) => {
                    const visibleItems = section.items.filter((item) => {
                        if (item.adminOnly && !isAdmin) return false;
                        if (item.flagKey && !((shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.(item.flagKey) ?? true))) return false;
                        // Fail-open while permissions load (no empty-nav flash),
                        // fail-closed once they have: the guard would refuse the
                        // click, so the menu doesn't offer it.
                        if (item.permKey && shell?.permissionsLoaded && !(shell?.hasPermission?.(item.permKey) ?? true)) return false;
                        return true;
                    });
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
