import React from 'react';
import { type ButtonVariant } from './Button';
export interface ComposerModeOption {
    /** e.g. `reply`, `note`, or a channel key (`email`, `whatsapp`). */
    value: string;
    label: string;
    /** `note` tints the composer as an internal note. */
    tone?: 'default' | 'note';
    placeholder?: string;
    /** Send button text in this mode, e.g. "Add note". The action id stays `send`. */
    sendLabel?: string;
}
export interface ComposerSendPayload {
    text: string;
    mode?: string;
}
export interface MessageComposerProps {
    /** Controlled text. Omit for uncontrolled (`defaultValue`). */
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    /** Called with the trimmed text. If it returns a promise, the text clears only after it resolves. */
    onSend: (payload: ComposerSendPayload) => void | Promise<unknown>;
    /** Mode / channel switch, shown when 2+ options are given (e.g. Reply | Internal note). */
    modes?: ComposerModeOption[];
    mode?: string;
    defaultMode?: string;
    onModeChange?: (mode: string) => void;
    placeholder?: string;
    /** Accessible name of the textarea. Default `Message`. */
    label?: string;
    /** Toolbar slot left of Send: attach button, emoji, … */
    attachAction?: React.ReactNode;
    /** Toolbar slot for a canned-reply / template picker. */
    cannedReplies?: React.ReactNode;
    /** Pending attachments (chips) under the textarea. */
    attachments?: React.ReactNode;
    /** Lets Send work with an empty text when files are attached. */
    hasAttachments?: boolean;
    disabled?: boolean;
    /** Send in flight: Send shows a spinner, the form is `busy`. */
    sending?: boolean;
    sendLabel?: string;
    sendVariant?: ButtonVariant;
    /** Enter sends, Shift+Enter adds a newline. When false, Ctrl/Cmd+Enter sends. Default true. */
    enterToSend?: boolean;
    /** Clear the text after a successful send (calls `onChange('')` when controlled). Default true. */
    clearOnSend?: boolean;
    rows?: number;
    /** Automation id of the form. Default `composer`. */
    name?: string;
    className?: string;
    'data-testid'?: string;
}
/**
 * Reply box for a ConversationThread. Comb: form `composer` > field `message` (textarea) + action `send`
 * (+ field `mode`, control radio, when a mode switch is shown). The textarea ref is forwarded so a canned-reply
 * picker can insert at the caret.
 */
export declare const MessageComposer: React.ForwardRefExoticComponent<MessageComposerProps & React.RefAttributes<HTMLTextAreaElement>>;
