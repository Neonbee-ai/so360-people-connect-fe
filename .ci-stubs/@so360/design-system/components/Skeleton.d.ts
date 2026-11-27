import React from 'react';
export type SkeletonVariant = 'text' | 'rect' | 'circle';
export interface SkeletonProps {
    variant?: SkeletonVariant;
    /** Number of text lines (variant="text" only). */
    lines?: number;
    className?: string;
    'data-testid'?: string;
}
export interface SkeletonPresetProps {
    count?: number;
    className?: string;
    [key: string]: any;
}
type Preset = React.FC<SkeletonPresetProps>;
export declare const Skeleton: React.FC<SkeletonProps> & {
    Table: Preset; Cards: Preset; Form: Preset; Fields: Preset; Detail: Preset; Kpis: Preset;
    Settings: Preset; List: Preset; Dashboard: Preset; Canvas: Preset; Header: Preset;
    Toolbar: Preset; Tabs: Preset; Aside: Preset; Page: Preset;
};
