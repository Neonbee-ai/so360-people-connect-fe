import React from 'react';
/**
 * `inbound` from the customer/contact, `outbound` from the team, `note` = internal note (never sent to the contact),
 * `system` = event line (assigned, status changed, call ended).
 */
export type ConversationMessageKind = 'inbound' | 'outbound' | 'note' | 'system';
export interface ConversationAuthor {
    name: string;
    avatarUrl?: string;
}
export interface ConversationMessage {
    /** Stable id; becomes the row's data-comb-id (slugified). */
    id: string;
    kind: ConversationMessageKind;
    author?: ConversationAuthor;
    body?: React.ReactNode;
    /** Display time, already formatted by the caller (org business settings), e.g. "10:42". */
    time?: string;
    /** ISO timestamp: machine value of <time> and the source for day separators. */
    dateTime?: string;
    /** Attachments slot (file chips, image grid, call recording …). */
    attachments?: React.ReactNode;
    /** Meta after the time, e.g. "Delivered" or a channel badge. */
    meta?: React.ReactNode;
    /** Per-message actions (reply, copy, convert to task). Counted as row actions under contract §6b. */
    actions?: React.ReactNode;
}
export interface ConversationThreadProps {
    messages: ConversationMessage[];
    /** Automation id of the thread region. Default `thread`. */
    name?: string;
    /** Accessible name of the thread. Default `Conversation`. */
    label?: string;
    /** First load: skeleton rows, state `loading`. */
    loading?: boolean;
    /** Replaces the default empty state. */
    emptyState?: React.ReactNode;
    /** Shows the "Load older messages" action at the top. */
    hasOlder?: boolean;
    onLoadOlder?: () => void;
    loadingOlder?: boolean;
    /** IANA zone used to group messages by day (org timezone from business settings). Default: the browser zone. */
    timeZone?: string;
    /** Day separator text for a `YYYY-MM-DD` key. Default: locale medium date in `timeZone`. */
    formatDay?: (day: string) => string;
    /** Keep the newest message in view when one is appended, and keep the reading position when older ones load. Default true. */
    autoScroll?: boolean;
    className?: string;
    'data-testid'?: string;
}
/** `YYYY-MM-DD` of an ISO timestamp in a time zone; undefined when the value does not parse. */
export declare function conversationDayKey(iso: string, timeZone?: string): string | undefined;
/**
 * Chat / ticket message thread (Inbox, Support). Same ordered-list semantics as `Timeline`, laid out as bubbles:
 * inbound left, outbound right, internal notes tinted, system events centred, day separators between days.
 * Comb: region `thread` (state loading | empty | ready); each message is a `row` with its id, so per-message
 * actions are row actions (§6b).
 */
export declare const ConversationThread: React.FC<ConversationThreadProps>;
