import React from 'react';
import { BadgeShape, BadgeSize, BadgeTone, BadgeVariant } from './Badge';
/** Status domains with a shared, cross-module tone vocabulary. */
export type StatusDomain = 'approval' | 'lifecycle' | 'attendance' | 'employment' | 'payment';
/**
 * Grouped semantic status vocabulary. Keys are snake_case; lookups normalise case, spaces and hyphens
 * (`In Review`, `in-review`, `IN_REVIEW` → `in_review`). Modules extend per-entity via `StatusBadge map`.
 */
export declare const STATUS_VOCAB: Readonly<Record<StatusDomain, Readonly<Record<string, BadgeTone>>>>;
/** Flat union of every STATUS_VOCAB domain (the StatusBadge default). Superset of the original 10 keys, same tones. */
export declare const DEFAULT_STATUS_MAP: Record<string, BadgeTone>;
/** Labels that title-casing gets wrong. */
export declare const STATUS_LABELS: Readonly<Record<string, string>>;
/** `In Review` / `in-review` / ` IN_REVIEW ` → `in_review`. */
export declare function normalizeStatus(status: string): string;
export declare function titleCase(value: string): string;
/** Human label for a status key: known overrides (WFH), else title case. */
export declare function statusLabel(status: string): string;
/**
 * Tone for a status. Order: `map` (case-insensitive, exact or normalised key) → `domain` vocab → every vocab →
 * `neutral` for unknown keys.
 */
export declare function statusTone(status: string, opts?: {
    map?: Record<string, BadgeTone>;
    domain?: StatusDomain;
}): BadgeTone;
export interface StatusBadgeProps {
    status: string;
    /** Overrides/extends the default map. Keys are matched case-insensitively. */
    map?: Record<string, BadgeTone>;
    /** Prefer this domain's vocabulary when a key exists in several. Optional; the default map covers all domains. */
    domain?: StatusDomain;
    /** Overrides the humanised label. */
    label?: React.ReactNode;
    size?: BadgeSize;
    /** Badge emphasis; `muted` suits dense tables (neutral text, coloured dot). */
    variant?: BadgeVariant;
    shape?: BadgeShape;
    className?: string;
    'data-testid'?: string;
}
export declare const StatusBadge: React.FC<StatusBadgeProps>;
