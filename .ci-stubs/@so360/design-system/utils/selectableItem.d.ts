/**
 * Comb state model for selectable items — nav links, list/tree items, table rows, menu and
 * listbox options, board cards. One source so "selected" never looks like "hover".
 *
 *   hover     → fg overlay at state-hover (works on any surface, both themes)
 *   focus     → 2px focus ring on :focus-visible only
 *   selected  → selected-token fill + selected-fg + 3px primary leading bar + semibold
 *   selected+hover → selected-hover fill (keeps the bar)
 *
 * Pair ITEM_SELECTED with the right ARIA: aria-current="page" (nav), aria-selected (option/row/tab),
 * aria-current="true" (active record in a list).
 */
export declare const ITEM_BASE = "relative transition-colors duration-nb-short3";
export declare const ITEM_HOVER = "hover:bg-fg/state-hover";
export declare const ITEM_FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface";
export declare const ITEM_SELECTED = "bg-selected text-selected-fg font-semibold shadow-nb-selected-bar rtl:shadow-nb-selected-bar-rtl hover:bg-selected-hover";
/**
 * Table rows: solid fills (sticky cells use bg-inherit, so a translucent overlay would let scrolled
 * content show through) and the leading bar on the first cell (box-shadow on <tr> is unreliable).
 */
export declare const ROW_HOVER = "hover:bg-surface-hover";
/** Bulk (checkbox) selection: fill only, so the open/active row (ROW_SELECTED) stays distinguishable. */
export declare const ROW_CHECKED = "bg-selected hover:bg-selected-hover";
export declare const ROW_SELECTED = "bg-selected text-selected-fg font-semibold hover:bg-selected-hover [&>td:first-child]:shadow-nb-selected-bar rtl:[&>td:first-child]:shadow-nb-selected-bar-rtl";
/** Highlighted-but-not-selected (keyboard active option in a listbox / menu). */
export declare const ITEM_ACTIVE = "bg-fg/state-hover";
export declare const ITEM_DISABLED = "opacity-50 cursor-not-allowed";
/** Compose the classes for one item. Unselected items get hover; selected items keep their own hover. */
export declare function selectableItemClass(opts?: {
    selected?: boolean;
    disabled?: boolean;
    focus?: boolean;
}): string;
