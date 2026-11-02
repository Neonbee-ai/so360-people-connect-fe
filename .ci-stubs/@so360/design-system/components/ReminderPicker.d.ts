import React from 'react';
export interface ReminderPickerProps {
    /** ISO instant, or null for none. Controlled when provided. */
    value?: string | null;
    defaultValue?: string | null;
    /** Fires with the chosen ISO instant, or null when cleared. */
    onChange?: (iso: string | null) => void;
    /** IANA zone used for presets, the custom picker and display. Default: the runtime zone. */
    timeZone?: string;
    /** "Now" for presets and past-date validation. Default: the current time. */
    now?: Date;
    /** Optional note. The note field is shown only when `onNoteChange` is provided. */
    note?: string;
    onNoteChange?: (note: string) => void;
    label?: string;
    disabled?: boolean;
    name?: string;
    'data-testid'?: string;
}
/** The instant whose wall-clock time in `timeZone` is y-m-d h:mi (month 1-based; day may overflow). */
export declare function zonedToInstant(y: number, m: number, d: number, h: number, mi: number, timeZone?: string): Date;
export type ReminderPresetId = 'later' | 'tomorrow' | 'three-days' | 'monday';
export declare const REMINDER_PRESETS: {
    id: ReminderPresetId;
    label: string;
}[];
/** Resolve a preset to an instant. Date-based presets land at 09:00 in `timeZone`. */
export declare function resolveReminderPreset(id: ReminderPresetId, now: Date, timeZone?: string): Date;
export declare const ReminderPicker: React.FC<ReminderPickerProps>;
