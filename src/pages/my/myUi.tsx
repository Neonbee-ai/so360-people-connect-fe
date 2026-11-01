import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar as CombAvatar, Badge, Card, KpiCard, Progress, Skeleton as CombSkeleton, Stack } from '@so360/design-system';

/**
 * Shared Comb kit for the employee self-service (/my) surface.
 *
 * Thin wrappers over @so360/design-system primitives so every /my page keeps a
 * single vocabulary (MyCard, StatTile, StatusPill, ProgressBar, Avatar,
 * Skeleton) while the visuals come from Comb tokens only.
 */

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export const MyCard: React.FC<{
    title: string;
    /** Retained for call-site compatibility; Comb Card headers carry no icon. */
    icon?: React.ReactNode;
    to?: string;
    actions?: React.ReactNode;
    /** Remove body padding (for flush lists). */
    flush?: boolean;
    children: React.ReactNode;
}> = ({ title, to, actions, flush, children }) => (
    <Card
        title={title}
        padding={flush ? 'none' : undefined}
        actions={
            actions ??
            (to ? (
                <Link to={to} className="text-nb-sm text-primary">
                    View all →
                </Link>
            ) : undefined)
        }
    >
        {children}
    </Card>
);

// ---------------------------------------------------------------------------
// Stat tile — one number that matters
// ---------------------------------------------------------------------------

export const StatTile: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: string;
}> = ({ label, value, hint }) => <KpiCard label={label} value={value as any} hint={hint} />;

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const PILL_TONES: Record<string, Tone> = {
    draft: 'neutral',
    pending: 'warning',
    approved: 'success',
    completed: 'success',
    active: 'primary',
    rejected: 'danger',
    cancelled: 'neutral',
    present: 'success',
    absent: 'danger',
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => (
    <Badge tone={PILL_TONES[status] ?? 'neutral'}>
        <span className="capitalize">{status}</span>
    </Badge>
);

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

export const ProgressBar: React.FC<{ percent: number }> = ({ percent }) => (
    <Progress value={Math.min(100, Math.max(0, percent))} max={100} />
);

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export const Avatar: React.FC<{ name?: string | null }> = ({ name }) => <CombAvatar name={name ?? '?'} size="sm" />;

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export const Skeleton: React.FC<{ rows?: number; className?: string }> = ({ rows = 3 }) => (
    <Stack gap="default">
        {[...Array(rows)].map((_, i) => (
            <CombSkeleton key={i} variant="rect" data-testid="my-skeleton" />
        ))}
    </Stack>
);
