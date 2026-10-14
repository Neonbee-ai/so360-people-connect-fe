import React from 'react';

/**
 * Payroll status chip. The shared StatusBadge maps person/leave statuses; the
 * payroll lifecycle introduces its own vocabulary (calculating, pending
 * approval, paying, paid, closed, upcoming, open, held, ...) so this chip owns
 * that map instead of widening the shared component's fixed dictionary.
 */
const chipStyles: Record<string, string> = {
    // Run lifecycle
    draft: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',
    calculating: 'bg-primary/10 text-primary border-primary/30',
    review: 'bg-warning/10 text-warning border-warning/30',
    pending_approval: 'bg-warning/10 text-warning border-warning/30',
    approved: 'bg-success/10 text-success border-success/30',
    paying: 'bg-primary/10 text-primary border-primary/30',
    paid: 'bg-success/10 text-success border-success/30',
    closed: 'bg-primary/10 text-primary border-primary/30',
    cancelled: 'bg-danger/10 text-danger border-danger/30',
    // Periods
    upcoming: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',
    open: 'bg-success/10 text-success border-success/30',
    processing: 'bg-primary/10 text-primary border-primary/30',
    // Declarations
    submitted: 'bg-primary/10 text-primary border-primary/30',
    under_review: 'bg-warning/10 text-warning border-warning/30',
    rejected: 'bg-danger/10 text-danger border-danger/30',
    reopened: 'bg-warning/10 text-warning border-warning/30',
    // Run employees / component kinds
    pending: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',
    calculated: 'bg-success/10 text-success border-success/30',
    excluded: 'bg-fg-subtle/10 text-fg-subtle border-fg-subtle/30',
    error: 'bg-danger/10 text-danger border-danger/30',
    earning: 'bg-success/10 text-success border-success/30',
    deduction: 'bg-danger/10 text-danger border-danger/30',
    employer_contribution: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    benefit: 'bg-primary/10 text-primary border-primary/30',
    // Misc
    active: 'bg-success/10 text-success border-success/30',
    inactive: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',
    archived: 'bg-primary/10 text-primary border-primary/30',
    published: 'bg-success/10 text-success border-success/30',
    held: 'bg-warning/10 text-warning border-warning/30',
    posted: 'bg-success/10 text-success border-success/30',
    not_posted: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30',
    failed: 'bg-danger/10 text-danger border-danger/30',
    statutory: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

interface StatusChipProps {
    status: string;
    label?: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ status, label }) => {
    const style = chipStyles[status] || 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30';
    const displayText = label || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-nb-sm text-xs font-medium border ${style}`}>
            {displayText}
        </span>
    );
};

export default StatusChip;
