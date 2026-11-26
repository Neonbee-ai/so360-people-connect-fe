import React from 'react';
import { Skeleton } from '@so360/design-system';

interface FieldLoadingProps {
    /** True while the options are loading. */
    loading: boolean;
    /** Text kept for screen readers (and specs) in place of the old inline "Loading…". */
    label?: string;
    className?: string;
    children: React.ReactNode;
    'data-testid'?: string;
}

/**
 * Wraps a picker/selector: while its options load, a field-shaped skeleton covers the input.
 * The input stays mounted underneath, so its state and any test handles survive the load.
 */
export const FieldLoading: React.FC<FieldLoadingProps> = ({ loading, label = 'Loading…', className, children, 'data-testid': testId = 'field-loading' }) => (
    <div className={`relative ${className ?? ''}`} aria-busy={loading || undefined}>
        {children}
        {loading && (
            <div className="absolute inset-0" data-testid={testId}>
                <Skeleton variant="rect" className="h-full w-full" />
                <span className="sr-only">{label}</span>
            </div>
        )}
    </div>
);

export default FieldLoading;
