import React from 'react';
export interface TimeEntry {
    id: string;
    minutes: number;
    /** ISO date (yyyy-mm-dd). */
    date?: string;
    note?: string;
    billable?: boolean;
}
export interface TimeLogEvent {
    minutes: number;
    note: string;
    billable: boolean;
    /** Epoch ms. */
    startedAt: number;
    /** Epoch ms. */
    endedAt: number;
    source: 'timer' | 'manual';
}
export interface TimeEntryPatch {
    minutes: number;
    note: string;
    billable: boolean;
}
export interface TimeTrackerProps {
    /** Controlled running flag. When defined, the parent owns timer state (pair with startedAt / elapsedBeforeMs). */
    running?: boolean;
    /** Controlled: epoch ms the current running segment began. */
    startedAt?: number;
    /** Controlled: ms accumulated before the current segment (paused time). Default 0. */
    elapsedBeforeMs?: number;
    onStart?: (startedAt: number) => void;
    onPause?: (elapsedMs: number) => void;
    onResume?: (startedAt: number) => void;
    /** Fires on Stop and on manual entry submit. */
    onLog: (event: TimeLogEvent) => void;
    entries?: TimeEntry[];
    /** May return a Promise; the row shows pending and rolls back when it rejects. */
    onEditEntry?: (id: string, patch: TimeEntryPatch) => void | Promise<unknown>;
    onDeleteEntry?: (id: string) => void | Promise<unknown>;
    readOnly?: boolean;
    /** Injectable clock (epoch ms). Defaults to Date.now. */
    now?: () => number;
    name?: string;
    className?: string;
    'data-testid'?: string;
}
/** Parses "1h 30m", "1h", "45m", "1:30" or "90" (minutes). Returns whole minutes or null. */
export declare function parseDuration(input: string): number | null;
export declare function formatMinutes(total: number): string;
export declare function formatElapsed(ms: number): string;
export declare const TimeTracker: React.FC<TimeTrackerProps>;
