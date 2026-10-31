import React from 'react';
export interface FilePickerTriggerProps {
    /** Native `accept` filter, e.g. `image/*,.pdf`. */
    accept?: string;
    multiple?: boolean;
    /** Called with the picked files (never called with an empty list). */
    onFiles: (files: File[]) => void;
    disabled?: boolean;
    /** Name of the hidden input (form posts / automation id). Default 'file'. */
    name?: string;
    /** `capture` hint for mobile cameras. */
    capture?: 'user' | 'environment';
    /**
     * Either a render prop receiving `open()` (wire it to any trigger), or a single element
     * (Button, IconButton, Link...) whose `onClick` is chained to open the picker.
     */
    children: React.ReactElement<{
        onClick?: React.MouseEventHandler;
        disabled?: boolean;
    }> | ((open: () => void) => React.ReactNode);
    'data-testid'?: string;
}
/**
 * Renders any trigger plus a visually hidden `<input type="file">`. Use it when the UI wants a
 * button/menu item/link rather than the FileUpload dropzone. Re-picking the same file fires again
 * (the input value is reset after each change).
 */
export declare const FilePickerTrigger: React.FC<FilePickerTriggerProps>;
