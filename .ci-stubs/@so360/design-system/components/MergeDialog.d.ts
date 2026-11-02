import React from 'react';
export interface MergeIds {
    primaryId: string;
    secondaryId: string;
}
export interface MergeField<T> {
    key: string;
    label: string;
    render?: (record: T) => React.ReactNode;
}
export interface MergeDialogProps<T extends {
    id: string;
}> {
    open: boolean;
    onClose: () => void;
    /** The record the user started from. */
    source: T;
    /** Async lookup; the source record is filtered out of the results. */
    search: (query: string) => Promise<T[]>;
    /** Resolves when merged (dialog then closes); a rejection shows an error banner. */
    onMerge: (ids: MergeIds) => void | Promise<unknown>;
    /** Display name of a record. */
    label: (record: T) => string;
    /** Singular noun, e.g. "ticket". */
    entityName?: string;
    /** Custom preview body; takes precedence over `fields`. */
    renderPreview?: (record: T) => React.ReactNode;
    /** Simple label/value rows for the preview. Values come from record[key] unless `render` is given. */
    fields?: MergeField<T>[];
    debounceMs?: number;
    name?: string;
    'data-testid'?: string;
}
/** Two-step merge flow: find a target, compare side by side, pick the primary, confirm. */
export declare function MergeDialog<T extends {
    id: string;
}>(props: MergeDialogProps<T>): React.ReactElement | null;
