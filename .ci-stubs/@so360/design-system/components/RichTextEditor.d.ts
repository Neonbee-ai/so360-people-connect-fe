import React from 'react';
export interface MentionPerson {
    id: string;
    name: string;
    avatarUrl?: string;
}
export type RichTextAction = 'bold' | 'italic' | 'bullet' | 'numbered' | 'link' | 'code' | 'codeblock';
export interface RichTextEditorProps {
    /** Controlled markdown. */
    value?: string;
    /** Uncontrolled initial markdown. */
    defaultValue?: string;
    /** Called with the new markdown and the people whose `@[Name](id)` token is still in it. */
    onChange?: (markdown: string, mentions: MentionPerson[]) => void;
    /** Async people lookup for the `@` popover; mentions are off without it. */
    searchPeople?: (query: string) => Promise<MentionPerson[]>;
    /** Debounce before `searchPeople` runs, in ms. Default 200. */
    mentionDebounceMs?: number;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    /** Hard limit; toolbar and mention inserts that would exceed it are ignored. Shows a counter. */
    maxLength?: number;
    error?: string;
    name?: string;
    /** Accessible name for the textarea. Default "Message". */
    label?: string;
    /** Shows Write / Preview tabs; Preview renders with MarkdownView. */
    preview?: boolean;
    rows?: number;
    className?: string;
    'data-testid'?: string;
}
/** People still referenced in `text`, de-duplicated by id, enriched from `known` (avatarUrl). */
export declare const extractMentions: (text: string, known?: Map<string, MentionPerson>) => MentionPerson[];
type Edit = {
    text: string;
    selStart: number;
    selEnd: number;
};
/** Pure toolbar transforms over (text, selection). Exported for reuse/tests. */
export declare const applyAction: (action: RichTextAction, text: string, s: number, e: number) => Edit;
export declare const RichTextEditor: React.FC<RichTextEditorProps>;
export {};
