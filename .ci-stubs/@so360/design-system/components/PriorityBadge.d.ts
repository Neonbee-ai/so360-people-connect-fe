import React from 'react';
import { type BadgeShape, type BadgeSize, type BadgeTone, type BadgeVariant } from './Badge';
export type Priority = 'critical' | 'urgent' | 'high' | 'medium' | 'normal' | 'low';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
/** Ordered most → least urgent (index 0 = highest). Use for sorting. */
export declare const PRIORITY_ORDER: readonly Priority[];
export declare const SEVERITY_ORDER: readonly Severity[];
/** Semantic tone per priority. `critical` also renders `solid` by default to stand apart from `urgent`. */
export declare const PRIORITY_TONES: Readonly<Record<Priority, BadgeTone>>;
export declare const SEVERITY_TONES: Readonly<Record<Severity, BadgeTone>>;
/** Ticketing aliases (case-insensitive). */
export declare const PRIORITY_ALIASES: Readonly<Record<string, Priority>>;
export declare const SEVERITY_ALIASES: Readonly<Record<string, Severity>>;
/** `'P1'` / `'High'` / `' urgent '` → canonical priority; `null` when unknown. */
export declare function normalizePriority(value: string | null | undefined): Priority | null;
export declare function normalizeSeverity(value: string | null | undefined): Severity | null;
/** Tone for a priority string (aliases accepted); unknown → `neutral`. */
export declare function priorityTone(value: string | null | undefined): BadgeTone;
export declare function severityTone(value: string | null | undefined): BadgeTone;
interface ScaleBadgeBaseProps {
    /** Overrides the canonical label (e.g. keep `P1`). */
    label?: React.ReactNode;
    /** Leading direction icon instead of the dot. Default false. */
    icon?: boolean;
    /** Leading tone dot. Default true (ignored when `icon`). */
    dot?: boolean;
    size?: BadgeSize;
    /** Defaults to `solid` for critical, else `soft`. */
    variant?: BadgeVariant;
    shape?: BadgeShape;
    className?: string;
    'data-testid'?: string;
}
export interface PriorityBadgeProps extends ScaleBadgeBaseProps {
    /** critical | urgent | high | medium | normal | low (any case) or P0–P4. Unknown → neutral, humanised. */
    priority: string;
}
export declare const PriorityBadge: React.FC<PriorityBadgeProps>;
export interface SeverityBadgeProps extends ScaleBadgeBaseProps {
    /** critical | high | medium | low | info (any case), sev1–sev4, s1–s4, blocker/major/minor. */
    severity: string;
}
export declare const SeverityBadge: React.FC<SeverityBadgeProps>;
export {};
