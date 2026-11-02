import React from 'react';
import { type FormFieldSize } from './FormField';
export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}
/** A labelled `<optgroup>`; `disabled` disables every option in the group. */
export interface SelectOptionGroup {
    label: string;
    options: SelectOption[];
    disabled?: boolean;
}
export type SelectItem = SelectOption | SelectOptionGroup;
export declare const isSelectOptionGroup: (o: SelectItem) => o is SelectOptionGroup;
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    /** Omit when nesting inside your own FormField. */
    label?: string;
    name: string;
    /** Flat options and/or `{ label, options }` groups (rendered as `<optgroup>`), freely mixed. */
    options: SelectItem[];
    /** Renders a disabled, empty-valued first option. */
    placeholder?: string;
    hint?: React.ReactNode;
    error?: string;
    required?: boolean;
    size?: FormFieldSize;
    /** 'inline' = borderless, quiet until hover/focus (M3 in-row edit). Default 'outlined'. */
    variant?: 'outlined' | 'inline';
    /** Convenience alongside the native onChange: receives the selected value. */
    onValueChange?: (value: string) => void;
    'data-testid'?: string;
}
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;
