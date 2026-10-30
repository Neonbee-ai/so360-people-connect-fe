import React from 'react';
export interface Recipients {
    to: string[];
    cc: string[];
    bcc: string[];
}
export interface RecipientSuggestion {
    email: string;
    name?: string;
}
export interface RecipientFieldProps {
    value?: Recipients;
    defaultValue?: Recipients;
    onChange?: (value: Recipients) => void;
    /** Makes the To row read-only (no add/remove). Cc/Bcc stay available. */
    lockTo?: boolean;
    /** Sync contact suggestions, filtered by email/name as the user types. */
    suggestions?: RecipientSuggestion[];
    /** Async contact search; called with the typed text. */
    searchContacts?: (query: string) => Promise<RecipientSuggestion[]>;
    disabled?: boolean;
    name?: string;
    'data-testid'?: string;
}
/** True for a plausible email address. */
export declare const isValidEmail: (v: string) => boolean;
/** To / Cc / Bcc email chip rows. `lockTo` freezes To only — the Cc/Bcc toggles always work. */
export declare const RecipientField: React.FC<RecipientFieldProps>;
