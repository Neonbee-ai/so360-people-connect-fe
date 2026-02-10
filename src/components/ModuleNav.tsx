import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Target, Clock, BarChart3, Activity } from 'lucide-react';

interface NavItem {
    path: string;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
}

const navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/people', label: 'People', icon: Users },
    { path: '/allocations', label: 'Allocations', icon: Target },
    { path: '/time', label: 'Time', icon: Clock },
    { path: '/utilization', label: 'Utilization', icon: BarChart3 },
    { path: '/events', label: 'Events', icon: Activity },
];

const ModuleNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="flex items-center gap-1 px-6 py-2 bg-slate-900/50 border-b border-slate-800">
            {navItems.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            active
                                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <Icon size={14} />
                        {item.label}
                    </button>
                );
            })}
        </nav>
    );
};

export default ModuleNav;
