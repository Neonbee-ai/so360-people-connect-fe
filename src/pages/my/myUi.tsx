import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * Shared chrome for the employee self-service (/my) surface.
 *
 * The first cut of these pages shipped with a light `bg-white` + `dark:` dual
 * theme while every other People Connect screen hardcodes the dark slate
 * palette — the MFE never sets Tailwind's `dark` class, so the cards rendered
 * as white boxes on a dark application. This kit exists so all /my pages draw
 * from the module's actual language: slate-900 surfaces, slate-800 borders,
 * teal accent, amber/emerald/rose statuses, skeleton loaders.
 */

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export const MyCard: React.FC<{
    title: string;
    icon?: React.ReactNode;
    to?: string;
    actions?: React.ReactNode;
    /** Remove body padding (for flush lists). */
    flush?: boolean;
    children: React.ReactNode;
}> = ({ title, icon, to, actions, flush, children }) => (
    <section className="rounded-nb border border-line bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div className="flex items-center gap-2.5">
                {icon && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-nb bg-primary/10 text-primary">
                        {icon}
                    </span>
                )}
                <h2 className="text-sm font-semibold text-fg">{title}</h2>
            </div>
            {actions}
            {to && !actions && (
                <Link
                    to={to}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors"
                >
                    View all <ArrowRight size={12} />
                </Link>
            )}
        </div>
        <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
);

// ---------------------------------------------------------------------------
// Stat tile — one number that matters, readable across the room
// ---------------------------------------------------------------------------

export const StatTile: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: string;
}> = ({ label, value, hint }) => (
    <div className="rounded-nb border border-line bg-surface p-4">
        <p className="text-xs text-fg-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-fg">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
    </div>
);

// ---------------------------------------------------------------------------
// Status pill — module dark palette
// ---------------------------------------------------------------------------

const PILL_STYLES: Record<string, string> = {
    draft: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/20',
    pending: 'bg-warning/10 text-warning border-warning/20',
    approved: 'bg-success/10 text-success border-success/20',
    completed: 'bg-success/10 text-success border-success/20',
    active: 'bg-primary/10 text-primary border-primary/20',
    rejected: 'bg-danger/10 text-danger border-danger/20',
    cancelled: 'bg-fg-subtle/10 text-fg-subtle border-fg-subtle/20',
    present: 'bg-success/10 text-success border-success/20',
    absent: 'bg-danger/10 text-danger border-danger/20',
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => (
    <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
            PILL_STYLES[status] ?? PILL_STYLES.draft
        }`}
    >
        {status}
    </span>
);

// ---------------------------------------------------------------------------
// Progress bar — teal fill on slate track
// ---------------------------------------------------------------------------

export const ProgressBar: React.FC<{ percent: number }> = ({ percent }) => (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
    </div>
);

// ---------------------------------------------------------------------------
// Avatar — initials chip
// ---------------------------------------------------------------------------

export const Avatar: React.FC<{ name?: string | null }> = ({ name }) => (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {name?.trim()?.slice(0, 1).toUpperCase() ?? '?'}
    </span>
);

// ---------------------------------------------------------------------------
// Skeleton — matches the module's pulse loaders
// ---------------------------------------------------------------------------

export const Skeleton: React.FC<{ rows?: number; className?: string }> = ({ rows = 3, className }) => (
    <div className={`space-y-3 ${className ?? ''}`} data-testid="my-skeleton">
        {[...Array(rows)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-nb bg-surface-raised/50" />
        ))}
    </div>
);

// ---------------------------------------------------------------------------
// Buttons — one primary per screen (teal); quiet secondary; destructive rose
// ---------------------------------------------------------------------------

export const primaryBtn =
    'flex items-center gap-2 rounded-nb bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryBtn =
    'flex items-center gap-2 rounded-nb border border-line-strong px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-raised hover:text-fg disabled:opacity-50';

export const dangerBtn =
    'flex items-center gap-2 rounded-nb bg-danger px-4 py-2 text-sm font-medium text-danger-fg transition-colors hover:bg-danger-hover disabled:opacity-60';

export const inputCls =
    'w-full rounded-nb border border-line-strong bg-surface-raised px-3 py-2 text-sm text-fg placeholder-slate-500 focus:border-primary focus:outline-none';

export const labelCls = 'mb-1 block text-xs text-fg-muted';
