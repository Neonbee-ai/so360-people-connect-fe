import React from 'react';
import { PopoverPlacement } from './Popover';
export interface MenuItem {
    label: string;
    onSelect: () => void;
    icon?: React.ReactNode;
    danger?: boolean;
    disabled?: boolean;
    /**
     * Makes this a checkable item: role="menuitemcheckbox" (or "menuitemradio" when
     * `type="radio"`) with aria-checked and a leading check icon. Omit for a plain action item.
     */
    checked?: boolean;
    /** Checkable item kind; only used when `checked` is defined. Default 'checkbox'. */
    type?: 'checkbox' | 'radio';
}
export interface MenuProps {
    trigger: React.ReactElement<Record<string, unknown>>;
    items: MenuItem[];
    placement?: PopoverPlacement;
    name?: string;
    /** Portal the menu out of clipping ancestors (default true, see Popover). */
    portal?: boolean;
    'data-testid'?: string;
}
/** Action menu (Popover + roving focus). */
export declare const Menu: React.FC<MenuProps>;
