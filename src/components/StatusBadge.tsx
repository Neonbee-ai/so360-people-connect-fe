import React from 'react';
import { Badge } from '@so360/design-system';

interface StatusBadgeProps {
    status: string;
    variant?: 'person' | 'allocation' | 'time' | 'default';
}

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const statusTones: Record<string, Tone> = {
    // Person statuses
    active: 'success',
    inactive: 'neutral',
    on_leave: 'warning',
    terminated: 'danger',
    archived: 'primary',

    // Allocation statuses
    planned: 'primary',
    completed: 'success',
    cancelled: 'neutral',

    // Time entry statuses
    draft: 'neutral',
    pending: 'warning',
    submitted: 'primary',
    approved: 'success',
    rejected: 'danger',

    // Type badges
    employee: 'primary',
    contractor: 'info',

    // Attendance statuses
    present: 'success',
    absent: 'danger',
    half_day: 'warning',
    leave: 'info',
    wfh: 'primary',
    on_duty: 'primary',
    holiday: 'neutral',
    weekend: 'neutral',
};

/** Thin adapter over the Comb Badge; keeps the legacy status vocabulary and display text. */
const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const tone = statusTones[status] || 'neutral';
    const displayText = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
        <Badge tone={tone} dot data-testid={`status-${status}`}>
            {displayText}
        </Badge>
    );
};

export default StatusBadge;
