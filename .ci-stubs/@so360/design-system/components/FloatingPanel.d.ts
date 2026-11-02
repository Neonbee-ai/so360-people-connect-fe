import React from 'react';
export type FloatingPanelDock = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export interface FloatingPanelPosition {
    x: number;
    y: number;
}
export interface FloatingPanelProps {
    open: boolean;
    title: string;
    subtitle?: React.ReactNode;
    /** Shows ✕ when given. */
    onClose?: () => void;
    children?: React.ReactNode;
    /** Pinned bar under the body (call controls, …). */
    footer?: React.ReactNode;
    /** Corner the panel docks to. Default `bottom-right`. */
    dock?: FloatingPanelDock;
    /** Drag by the header (pointer) or move with arrow keys on the grip. Default true. */
    draggable?: boolean;
    /** Controlled position (px from the viewport top-left). `null` = docked. */
    position?: FloatingPanelPosition | null;
    defaultPosition?: FloatingPanelPosition | null;
    onPositionChange?: (position: FloatingPanelPosition | null) => void;
    /** Controlled minimised state (header only). */
    minimized?: boolean;
    defaultMinimized?: boolean;
    onMinimizedChange?: (minimized: boolean) => void;
    /** Shows the minimise toggle. Default true. */
    minimizable?: boolean;
    /** Escape (focus inside the panel) calls `onClose`. Default false — a live call must not end on a stray key. */
    closeOnEscape?: boolean;
    /** Keep children mounted while closed (hidden, state `closed`), e.g. to keep an audio element alive. */
    keepMounted?: boolean;
    size?: 'sm' | 'md';
    name?: string;
    className?: string;
    'data-testid'?: string;
}
/**
 * Non-modal floating panel (softphone dialer, call widget, mini chat): no backdrop, no focus trap, no scroll lock,
 * so the page underneath stays usable. Docked to a corner by default; drag the header to move it, `Dock` returns it.
 * Layer: `z-drawer` (non-modal: below modal dialogs and toasts; a later drawer stacks over it). Comb: `dialog` with `data-comb-variant="floating"`,
 * state `open | closed` + `expanded | collapsed`.
 */
export declare const FloatingPanel: React.FC<FloatingPanelProps>;
