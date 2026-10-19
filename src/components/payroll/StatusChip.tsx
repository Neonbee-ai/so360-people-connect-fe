import React from 'react';
import { Badge } from '@so360/design-system';

/**
 * Payroll status chip. The shared StatusBadge maps person/leave statuses; the
 * payroll lifecycle introduces its own vocabulary (calculating, pending
 * approval, paying, paid, closed, upcoming, open, held, ...) so this chip owns
 * that map instead of widening the shared component's fixed dictionary.
 */
type ChipTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const chipTones: Record<string, ChipTone> = {
    approved: 'success',
    paid: 'success',
    open: 'success',
    calculated: 'success',
    earning: 'success',
    active: 'success',
    published: 'success',
    posted: 'success',
    calculating: 'primary',
    paying: 'primary',
    closed: 'primary',
    processing: 'primary',
    submitted: 'primary',
    benefit: 'primary',
    archived: 'primary',
    review: 'warning',
    pending_approval: 'warning',
    under_review: 'warning',
    reopened: 'warning',
    held: 'warning',
    cancelled: 'danger',
    rejected: 'danger',
    error: 'danger',
    deduction: 'danger',
    failed: 'danger',
    employer_contribution: 'info',
    statutory: 'info',
    draft: 'neutral',
    upcoming: 'neutral',
    pending: 'neutral',
    excluded: 'neutral',
    inactive: 'neutral',
    not_posted: 'neutral',
};

interface StatusChipProps {
    status: string;
    label?: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ status, label }) => {
    const tone = chipTones[status] || 'neutral';
    const displayText = label || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return <Badge tone={tone} size="sm">{displayText}</Badge>;
};

export default StatusChip;
