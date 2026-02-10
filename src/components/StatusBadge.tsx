import React from 'react';

interface StatusBadgeProps {
    status: string;
    variant?: 'person' | 'allocation' | 'time' | 'default';
}

const statusStyles: Record<string, string> = {
    // Person statuses
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    on_leave: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    terminated: 'bg-rose-500/10 text-rose-400 border-rose-500/30',

    // Allocation statuses
    planned: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',

    // Time entry statuses
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/30',

    // Type badges
    employee: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    contractor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const style = statusStyles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    const displayText = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${style}`}>
            {displayText}
        </span>
    );
};

export default StatusBadge;
