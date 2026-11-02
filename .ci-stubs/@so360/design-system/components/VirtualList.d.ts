import React from 'react';
export interface VirtualListItemState {
    /** Roving-focus target (the item that holds tabIndex=0). */
    active: boolean;
    /** Matches `selectedKey`. */
    selected: boolean;
}
export interface VirtualListProps<T> {
    items: T[];
    getKey: (item: T, index: number) => string | number;
    renderItem: (item: T, index: number, state: VirtualListItemState) => React.ReactNode;
    /** Starting height estimate per item in px (number, or per-index function). Actual heights are measured after render. Default 48. */
    estimateSize?: number | ((index: number) => number);
    /** Items mounted beyond each edge of the viewport. Default 6. */
    overscan?: number;
    /** Fires once per `items.length` when the scroll position is within `endReachedThreshold` px of the end. */
    onEndReached?: () => void;
    /** Distance from the end, in px, that counts as reached. Default 200. */
    endReachedThreshold?: number;
    /** Shows the loading footer and suppresses `onEndReached`. */
    loadingMore?: boolean;
    /** `false` suppresses `onEndReached` and shows the end-of-list footer (when `endText` is given). Default true. */
    hasMore?: boolean;
    /** Called on Enter or click. */
    onSelect?: (item: T, index: number) => void;
    selectedKey?: string | number | null;
    /** `listbox` makes items `option`s with aria-selected. Default `list`. */
    role?: 'list' | 'listbox';
    'aria-label'?: string;
    /** Rendered instead of the list when `items` is empty (and not loading). */
    emptyState?: React.ReactNode;
    loadingText?: React.ReactNode;
    /** Footer when `hasMore` is false; omitted when not given. */
    endText?: React.ReactNode;
    /** Max height of the scroll container (CSS length or px). Default 24rem. */
    maxHeight?: number | string;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
/** Generic windowed list (variable heights, overscan, infinite scroll, roving focus). Falls back to rendering every item when the container measures 0 height. */
export declare const VirtualList: <T>(props: VirtualListProps<T> & {
    ref?: React.Ref<HTMLDivElement> | undefined;
}) => React.ReactElement | null;
