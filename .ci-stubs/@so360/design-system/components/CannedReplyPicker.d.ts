import React from 'react';
export interface CannedReply {
    id: string;
    title: string;
    body: string;
    category?: string;
}
export interface CannedReplyPickerProps {
    /** Sync list, filtered client-side by title, body and category. */
    replies?: CannedReply[];
    /** Async source; called with the search text (empty on open). Wins over `replies` when both are given. */
    load?: (query: string) => Promise<CannedReply[]>;
    onSelect: (reply: CannedReply) => void;
    /** Trigger button text. */
    label?: string;
    placeholder?: string;
    emptyText?: string;
    disabled?: boolean;
    name?: string;
    'data-testid'?: string;
}
/** Searchable canned-reply picker; drops into `MessageComposer`'s `cannedReplies` slot. */
export declare const CannedReplyPicker: React.FC<CannedReplyPickerProps>;
