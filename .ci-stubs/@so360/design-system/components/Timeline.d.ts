import React from 'react';
export type TimelineTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export interface TimelineItem {
    id: string;
    /** Icon inside the marker (defaults to a dot). */
    icon?: React.ReactNode;
    /** Who did it, e.g. "Priya Nair". */
    actor?: string;
    /** What happened, e.g. "sent invoice INV-2041". */
    title: React.ReactNode;
    /** Longer detail / note. */
    body?: React.ReactNode;
    /** Human display time, e.g. "2h ago". */
    time?: string;
    /** Machine-readable timestamp for <time dateTime>. */
    dateTime?: string;
    tone?: TimelineTone;
    /** Category used by `filters` (matches `TimelineFilter.id`). */
    type?: string;
}
export interface TimelineFilter {
    id: string;
    label: string;
}
/** Filter id meaning "no filtering". */
export declare const TIMELINE_ALL_FILTER = "all";
export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> {
    items: TimelineItem[];
    /** Insert a day header between items on different calendar days (needs `dateTime`). */
    groupByDay?: boolean;
    /** IANA zone used to decide which day an item belongs to. Default: the runtime zone. */
    timeZone?: string;
    /** Day header text for a `YYYY-MM-DD` key. Default: locale medium date. */
    formatDay?: (day: string) => string;
    /** Filter chips (an "All" chip is added first). Items are matched on `item.type`. */
    filters?: TimelineFilter[];
    /** Controlled filter id; omit for uncontrolled (starts on "All"). */
    activeFilter?: string;
    onFilterChange?: (id: string) => void;
    /** Show a "Load more" button below the list. */
    hasMore?: boolean;
    onLoadMore?: () => void;
    loadingMore?: boolean;
    /** Rendered instead of the list when there is nothing to show. */
    emptyState?: React.ReactNode;
    /** Show skeleton rows instead of the list. */
    loading?: boolean;
    /** Names the filter/test-id group. */
    name?: string;
}
export declare const Timeline: React.FC<TimelineProps>;
