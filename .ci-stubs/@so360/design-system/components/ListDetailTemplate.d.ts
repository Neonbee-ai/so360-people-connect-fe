import React from 'react';
import { type CombPageProps } from './usePageComb';
import { type TrailItem } from './PageTrail';
export interface ListDetailTemplateProps extends CombPageProps {
    list: React.ReactNode;
    detail: React.ReactNode;
    /** True when an item is selected. On compact/medium windows this switches the single visible pane to the detail. */
    hasSelection: boolean;
    /**
     * Ancestors of the selected record (nearest last). Shown above the detail pane; on compact/medium windows the
     * `←` goes to the last item (e.g. the list route).
     */
    trail?: TrailItem[];
    /** Back on small windows (e.g. clear the selection). Takes precedence over the trail's back target. */
    onBack?: () => void;
    backLabel?: string;
    /** Shown in the detail pane when nothing is selected (two-pane layout only). */
    emptyDetail?: React.ReactNode;
    /**
     * Optional third pane with context for the selected record (contact, ticket info). Right column at wc-large+.
     * Below wc-large it never takes layout space: open it is a right Comb `Drawer` (below the app bar, backdrop, Esc,
     * ✕), closed it renders nothing, so the consumer puts an icon toggle (e.g. ⓘ) in the detail toolbar. Shown only
     * while `hasSelection`. Comb: region `context`, state `expanded | collapsed`; drawer `context`.
     */
    context?: React.ReactNode;
    /** Heading + accessible name of the context pane. Default `Details`. */
    contextTitle?: string;
    /** Controlled expanded state of the context pane. */
    contextOpen?: boolean;
    /** Uncontrolled initial state. Default true. */
    defaultContextOpen?: boolean;
    onContextOpenChange?: (open: boolean) => void;
    /**
     * Controlled: true narrows the list column to `collapsedList` (a slim rail) at wc-expanded+. Small windows always
     * show the full list. The consumer owns the collapse/expand controls. Comb: region `list_rail`.
     */
    listCollapsed?: boolean;
    /**
     * Rail shown in place of the list while `listCollapsed` (e.g. avatars + an expand button). Below the split it also
     * stays beside the selected detail, so the list never fully disappears.
     */
    collapsedList?: React.ReactNode;
    /**
     * Window class where list and detail go side by side. `expanded` (840px, default) or `medium` (600px) for
     * list-first modules such as Inbox.
     */
    splitAt?: SplitAt;
    /**
     * Controlled: below the split, with a selection, shows the full `list` in a left drawer over the detail (e.g. opened
     * from the rail) so switching records never leaves the detail. Closed automatically once the window reaches the
     * split. When `onListDrawerOpenChange` is given, the small-window back slot becomes a list icon button that opens
     * it. Comb: drawer `list_drawer`, button `open_list_drawer`.
     */
    listDrawerOpen?: boolean;
    onListDrawerOpenChange?: (open: boolean) => void;
    /** Title + accessible name of the list drawer. Default `List`. */
    listTitle?: string;
    /**
     * Opt-in: fill the parent's height instead of growing the page. The root becomes `h-full min-h-0 overflow-hidden`
     * with one `minmax(0,1fr)` row; list, rail and context each scroll on their own; the detail pane is a
     * `min-h-0` flex column with no scroll of its own, so the consumer pins its header/composer and scrolls the middle.
     * Needs a parent with a definite height (e.g. a flex-1 min-h-0 chain from the shell's main). Default false.
     */
    fillViewport?: boolean;
    className?: string;
}
export type SplitAt = 'expanded' | 'medium';
/** M3 canonical list-detail: two panes from `splitAt` (default wc-expanded), one pane (with back, plus the rail) below; optional third `context` pane at wc-large+. */
export declare const ListDetailTemplate: React.FC<ListDetailTemplateProps>;
