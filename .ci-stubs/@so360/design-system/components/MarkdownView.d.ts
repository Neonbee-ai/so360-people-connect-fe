import React from 'react';
/**
 * Safe markdown-lite renderer. The source is parsed into React elements — no
 * `dangerouslySetInnerHTML` anywhere — so raw HTML in the input is escaped by
 * React and shows up as literal text.
 *
 * Supported: `#`–`######` headings, `**bold**`, `*italic*` / `_italic_`,
 * `` `inline code` ``, fenced ``` code blocks, `-`/`*`/`+` and `1.` lists,
 * `[label](url)` links, single line breaks and `@[Name](id)` mention chips.
 * Links render only for http, https and mailto; any other scheme (javascript:,
 * data:, vbscript:, relative paths) renders the label as plain text.
 */
export interface MarkdownViewProps {
    /** Markdown source. */
    value: string;
    /** Called with the person id when a mention chip is clicked; chips are plain text without it. */
    onMentionClick?: (id: string, name: string) => void;
    /** Shown when `value` is empty or whitespace. */
    emptyText?: React.ReactNode;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
/** True for http(s) and mailto URLs only. */
export declare const isSafeUrl: (url: string) => boolean;
/** `@[Name](id)` — the mention token RichTextEditor writes. */
export declare const MENTION_TOKEN: RegExp;
/** Parse markdown-lite into React nodes (exported for reuse in previews). */
export declare const renderMarkdown: (src: string, opts?: {
    onMentionClick?: MarkdownViewProps['onMentionClick'];
    testId?: string;
}) => React.ReactNode[];
export declare const MarkdownView: React.FC<MarkdownViewProps>;
