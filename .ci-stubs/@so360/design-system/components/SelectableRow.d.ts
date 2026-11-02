import React from 'react';
export type SelectableRowRole = 'option' | 'radio' | 'checkbox' | 'button';
export interface SelectableRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'onSelect' | 'role'> {
    /** Primary line. Use `children` instead for fully custom content. */
    title?: React.ReactNode;
    /** Muted second line (truncates). */
    description?: React.ReactNode;
    /** Leading slot: Avatar, IconTile, Checkbox visual, thumbnail. */
    leading?: React.ReactNode;
    /** Trailing slot: Badge, timestamp, count, chevron. Clicks on interactive content here do not select the row. */
    trailing?: React.ReactNode;
    selected?: boolean;
    /** Called on click / Enter / Space. Receives `value` when given. */
    onSelect?: (value?: string) => void;
    /** Identifies the row to `onSelect` and the automation id. */
    value?: string;
    disabled?: boolean;
    /**
     * ARIA pattern. `option` (default; place rows inside a `role="listbox"` container) uses aria-selected;
     * `radio`/`checkbox` use aria-checked; `button` uses aria-pressed.
     */
    role?: SelectableRowRole;
    /** Vertical density. Default 'md'. */
    density?: 'sm' | 'md';
    'data-testid'?: string;
}
/**
 * Selectable list row (A8): leading / title+description / trailing, selected = primary border + tint
 * (same tokens as SelectableCard). Keyboard: Enter/Space select, ArrowUp/Down/Home/End move between sibling rows.
 */
export declare const SelectableRow: React.ForwardRefExoticComponent<SelectableRowProps & React.RefAttributes<HTMLDivElement>>;
/** Alias: same component, for call sites that think in "list rows". */
export declare const ListRow: React.ForwardRefExoticComponent<SelectableRowProps & React.RefAttributes<HTMLDivElement>>;
export type ListRowProps = SelectableRowProps;
