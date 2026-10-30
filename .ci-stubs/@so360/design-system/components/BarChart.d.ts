import React from 'react';
export type BarChartOrientation = 'vertical' | 'horizontal';
export type BarChartTone = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';
export interface BarChartDatum {
    label: string;
    /** `null` / non-finite values keep their slot but draw no bar. */
    value: number | null | undefined;
    /** Per-bar tone; overrides the chart `tone`. */
    tone?: BarChartTone;
}
export interface BarChartProps {
    data: BarChartDatum[];
    orientation?: BarChartOrientation;
    tone?: BarChartTone;
    width?: number;
    height?: number;
    /** Category labels under (vertical) or beside (horizontal) the bars. */
    showLabels?: boolean;
    /** Value text at the end of each bar. */
    showValues?: boolean;
    /** Formats values for value text, bar titles and the summary. */
    valueFormatter?: (value: number) => string;
    /** Horizontal only: width reserved for category labels. */
    labelWidth?: number;
    /** Accessible description; defaults to a per-bar summary. */
    label?: string;
    className?: string;
    'data-testid'?: string;
}
/** Dependency-free inline SVG bar chart (vertical / horizontal, handles negatives). */
export declare const BarChart: React.FC<BarChartProps>;
