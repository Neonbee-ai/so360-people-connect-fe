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
    <section className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
                {icon && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                        {icon}
                    </span>
                )}
                <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
            </div>
            {actions}
            {to && !actions && (
                <Link
                    to={to}
                    className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-50">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
);

// ---------------------------------------------------------------------------
// Status pill — module dark palette
// ---------------------------------------------------------------------------

const PILL_STYLES: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    active: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    cancelled: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    present: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    absent: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
    </div>
);

// ---------------------------------------------------------------------------
// Avatar — initials chip
// ---------------------------------------------------------------------------

export const Avatar: React.FC<{ name?: string | null }> = ({ name }) => (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-xs font-semibold text-teal-400">
        {name?.trim()?.slice(0, 1).toUpperCase() ?? '?'}
    </span>
);

// ---------------------------------------------------------------------------
// Skeleton — matches the module's pulse loaders
// ---------------------------------------------------------------------------

export const Skeleton: React.FC<{ rows?: number; className?: string }> = ({ rows = 3, className }) => (
    <div className={`space-y-3 ${className ?? ''}`} data-testid="my-skeleton">
        {[...Array(rows)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-800/50" />
        ))}
    </div>
);

// ---------------------------------------------------------------------------
// Buttons — one primary per screen (teal); quiet secondary; destructive rose
// ---------------------------------------------------------------------------

export const primaryBtn =
    'flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryBtn =
    'flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-50 disabled:opacity-50';

export const dangerBtn =
    'flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60';

export const inputCls =
    'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:border-teal-500 focus:outline-none';

export const labelCls = 'mb-1 block text-xs text-slate-400';
