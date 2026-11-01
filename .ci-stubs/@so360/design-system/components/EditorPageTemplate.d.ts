import React from 'react';
import { type CombPageProps } from './usePageComb';
import { type Breadcrumb } from './PageHeader';
import type { TrailItem } from './PageTrail';
export interface EditorPageTemplateProps extends CombPageProps {
    title: string;
    description?: string;
    trail?: TrailItem[];
    /** @deprecated Use `trail`. */
    breadcrumbs?: Breadcrumb[];
    meta?: React.ReactNode;
    /** Up to 2 outlined secondary header buttons (e.g. Preview), left of the primary. */
    secondaryActions?: React.ReactNode;
    /** The one main verb (e.g. Publish / Save). */
    primaryAction?: React.ReactNode;
    /** Editor toolbar row under the header (formatting, zoom, undo/redo). */
    toolbar?: React.ReactNode;
    /** Left rail: outline, layers, blocks palette, page list. Omit for a two-pane editor. */
    left?: React.ReactNode;
    /** Right inspector: properties of the selected element. Omit for a two-pane editor. */
    right?: React.ReactNode;
    /** The canvas (document, form builder, email designer...). */
    children?: React.ReactNode;
    /** Heading + accessible name of the left rail. Default 'Outline'. */
    leftTitle?: string;
    /** Heading + accessible name of the inspector. Default 'Inspector'. */
    rightTitle?: string;
    /** Accessible name of the canvas region. Default 'Canvas'. */
    canvasLabel?: string;
    /** Controlled left-rail state. */
    leftOpen?: boolean;
    /** Uncontrolled initial left-rail state. Default true. */
    defaultLeftOpen?: boolean;
    onLeftOpenChange?: (open: boolean) => void;
    /** Controlled inspector state. */
    rightOpen?: boolean;
    /** Uncontrolled initial inspector state. Default true. */
    defaultRightOpen?: boolean;
    onRightOpenChange?: (open: boolean) => void;
    /** Shown while loading; sets comb page state `loading` instead of `ready`. */
    loading?: boolean;
    className?: string;
}
/**
 * Editor floorplan (A9): header, optional toolbar, then left rail / canvas / right inspector.
 * From wc-expanded the three panes sit side by side and each side pane collapses to a slim icon column;
 * below that they stack (rail, canvas, inspector) and collapse to their header bar. Comb page type `editor`;
 * regions `left_rail`, `canvas`, `inspector` (state `expanded | collapsed`).
 *
 * @example
 * <EditorPageTemplate title="Welcome email" module="marketing" entity="template" record={id}
 *   primaryAction={<Button>Publish</Button>} toolbar={<EditorToolbar />}
 *   left={<BlocksPalette />} right={<BlockInspector />}>
 *   <EmailCanvas />
 * </EditorPageTemplate>
 */
export declare const EditorPageTemplate: React.FC<EditorPageTemplateProps>;
