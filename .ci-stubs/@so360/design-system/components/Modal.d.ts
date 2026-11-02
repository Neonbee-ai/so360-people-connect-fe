import React from 'react';
export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
    footer?: React.ReactNode;
    children?: React.ReactNode;
    /** Click on the backdrop closes the modal. Default true. */
    closeOnOverlayClick?: boolean;
    /** Element to focus on open; defaults to the first focusable control. */
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    /** When false, Escape / backdrop / close button do nothing (e.g. while saving). Default true. */
    dismissible?: boolean;
    /** Body padding; set false when content brings its own sections. Default true. */
    bodyPadding?: boolean;
    /** Used for the derived test id (falls back to title when it is a string). */
    name?: string;
    /** Id of a `<form>` in the body. The primary `<Button>` in `footer` (no explicit `type`/`form`) becomes
     * `type="submit" form={formId}`, so Enter in a field and the footer button share one submit path.
     * With no `footer`, a default Cancel + submit footer is rendered (see `submitLabel`/`cancelLabel`). */
    formId?: string;
    /** Label of the auto footer's submit button (formId without footer). Default 'Save'. */
    submitLabel?: React.ReactNode;
    /** Label of the auto footer's cancel button. Default 'Cancel'. */
    cancelLabel?: React.ReactNode;
    /** Auto footer: spinner + disabled submit, and cancel disabled. */
    submitLoading?: boolean;
    /** Auto footer: disables the submit button. */
    submitDisabled?: boolean;
    'data-testid'?: string;
}
/**
 * Centered, portaled dialog with focus trap, Esc-to-close, focus restore and
 * body scroll lock. Prefer Drawer for create/edit flows; use Modal for short
 * decisions and confirmations.
 */
export declare const Modal: React.FC<ModalProps>;
