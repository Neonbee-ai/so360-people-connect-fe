import React from 'react';
import { type FormFieldSize } from './FormField';
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
    /** Omit when nesting inside your own FormField. */
    label?: string;
    name: string;
    /** Helper text under the field; may hold inline markup (e.g. a Link). */
    hint?: React.ReactNode;
    error?: string;
    required?: boolean;
    size?: FormFieldSize;
    leadingIcon?: React.ComponentType<{
        className?: string;
    }>;
    /** Inline adornment before the value (e.g. `₹`, `https://`, a currency picker). Part of the field chrome. */
    prefix?: React.ReactNode;
    /** Inline adornment after the value (e.g. `kg`, `.neonbee.app`, an IconButton). Part of the field chrome. */
    suffix?: React.ReactNode;
    'data-testid'?: string;
}
export declare const TextField: React.ForwardRefExoticComponent<TextFieldProps & React.RefAttributes<HTMLInputElement>>;
