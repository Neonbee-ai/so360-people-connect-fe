import React from 'react';
export type SlaStatus = 'running' | 'paused' | 'met' | 'breached';
export type SlaTone = 'neutral' | 'warning' | 'danger' | 'success';
export type SlaVariant = 'full' | 'compact';
export interface SlaCountdownProps {
    /** ISO timestamp the SLA must be met by. */
    target: string;
    status: SlaStatus;
    /** Turns the tone to warning when this many minutes (or fewer) are left. Default 30. */
    warnBeforeMinutes?: number;
    /** Text shown before the countdown in the full variant, e.g. "First response". */
    label?: string;
    variant?: SlaVariant;
    /** Clock source; called on every tick. Default `() => new Date()`. Inject for tests. */
    now?: () => Date;
    /** Names the test-id. */
    name?: string;
    className?: string;
}
/** "2h 14m", "14m 05s" (seconds only under an hour and when asked), "30s", "3d 4h". */
export declare function formatSlaDuration(ms: number, withSeconds: boolean): string;
export declare const SlaCountdown: React.FC<SlaCountdownProps>;
