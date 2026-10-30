import React from 'react';
export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: React.ReactNode;
    /** Extra body content rendered below the message (e.g. an impact list or a reason field). */
    detail?: React.ReactNode;
    /** Externally-driven busy state (e.g. a mutation's isPending). OR'd with the internal async busy state:
     * disables both buttons, blocks dismiss and shows a spinner on the confirm button. */
    busy?: boolean;
    confirmLabel?: string;
    cancelLabel?: string;
    intent?: 'default' | 'danger';
    /** May return a Promise; the dialog shows a busy state until it settles. */
    onConfirm: () => void | Promise<unknown>;
    onCancel: () => void;
    /** Called after onConfirm resolves. Falls back to onCancel. */
    onClose?: () => void;
    name?: string;
    'data-testid'?: string;
}
/** Replacement for window.confirm, built on Modal. */
export declare const ConfirmDialog: React.FC<ConfirmDialogProps>;
export type ConfirmOptions = Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel' | 'onClose'>;
/** Imperative confirm: `const [confirm, dialog] = useConfirm(); if (await confirm({...}))`. */
export declare function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, React.ReactElement];
