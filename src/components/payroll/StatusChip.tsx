import React from 'react';

/**
 * Payroll status chip. The shared StatusBadge maps person/leave statuses; the
 * payroll lifecycle introduces its own vocabulary (calculating, pending
 * approval, paying, paid, closed, upcoming, open, held, ...) so this chip owns
 * that map instead of widening the shared component's fixed dictionary.
 */
const chipStyles: Record<string, string> = {
    // Run lifecycle
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    calculating: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    review: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    pending_approval: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    paying: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    closed: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    // Periods
    upcoming: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    open: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    processing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    // Declarations
    submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    under_review: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    reopened: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    // Run employees / component kinds
    pending: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    calculated: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    excluded: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
    error: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    earning: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    deduction: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    employer_contribution: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    benefit: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    // Misc
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    archived: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    held: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    posted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    not_posted: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    failed: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    statutory: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

interface StatusChipProps {
    status: string;
    label?: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ status, label }) => {
    const style = chipStyles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    const displayText = label || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${style}`}>
            {displayText}
        </span>
    );
};

export default StatusChip;
