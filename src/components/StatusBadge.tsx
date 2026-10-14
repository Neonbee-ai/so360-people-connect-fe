import React from 'react';

interface StatusBadgeProps {
    status: string;
    variant?: 'person' | 'allocation' | 'time' | 'default';
}

const statusStyles: Record<string, string> = {
    // Person statuses
    active: 'bg-success/10 text-success border-success/30',
    inactive: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',
    on_leave: 'bg-warning/10 text-warning border-warning/30',
    terminated: 'bg-danger/10 text-danger border-danger/30',
    archived: 'bg-primary/10 text-primary border-primary/30',

    // Allocation statuses
    planned: 'bg-primary/10 text-primary border-primary/30',
    completed: 'bg-success/10 text-success border-success/30',
    cancelled: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',

    // Time entry statuses
    draft: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',
    pending: 'bg-warning/10 text-warning border-warning/30',
    submitted: 'bg-primary/10 text-primary border-primary/30',
    approved: 'bg-success/10 text-success border-success/30',
    rejected: 'bg-danger/10 text-danger border-danger/30',

    // Type badges
    employee: 'bg-primary/10 text-primary border-primary/30',
    contractor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',

    // Attendance statuses
    present: 'bg-success/10 text-success border-success/30',
    absent: 'bg-danger/10 text-danger border-danger/30',
    half_day: 'bg-warning/10 text-warning border-warning/30',
    leave: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    wfh: 'bg-primary/10 text-primary border-primary/30',
    on_duty: 'bg-primary/10 text-primary border-primary/30',
    holiday: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',
    weekend: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const style = statusStyles[status] || 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30';
    const displayText = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-nb-sm text-xs font-medium border ${style}`}>
            {displayText}
        </span>
    );
};

export default StatusBadge;
