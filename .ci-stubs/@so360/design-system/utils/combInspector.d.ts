export interface CombNode {
    kind: string;
    id?: string;
    label?: string;
    state: string[];
    control?: string;
    variant?: string;
    value?: unknown;
    children: CombNode[];
}
export interface CombPageSnapshot {
    version: number;
    type?: string;
    module?: string;
    entity?: string;
    record?: string;
    title?: string;
    state: string[];
    regions: {
        id?: string;
        title?: string;
        state: string[];
    }[];
    actions: {
        id?: string;
        label?: string;
        variant?: string;
        state: string[];
        scope: string;
    }[];
    tabs: {
        id?: string;
        label?: string;
        state: string[];
    }[];
    fields: {
        id?: string;
        label?: string;
        control?: string;
        state: string[];
        value?: unknown;
        scope: string;
    }[];
    tables: {
        id?: string;
        state: string[];
        columns: string[];
        rows: number;
    }[];
    /** `variant` is `floating` for a non-modal FloatingPanel (the page underneath stays usable). */
    overlays: {
        kind: string;
        id?: string;
        title?: string;
        variant?: string;
        state: string[];
    }[];
    toasts: {
        id?: string;
        text: string;
        tone?: string;
    }[];
    /** Page ancestors from the breadcrumb row, root first; the current page (the title) is not included. */
    trail: {
        label: string;
        to?: string;
    }[];
    /** Where the `←` back action goes, when the page has one. */
    back?: {
        label: string;
        to?: string;
    };
    /** Shell navigation state; `subnav` comes from `[data-comb="nav"][data-comb-id="subnav"]` (Shell-stamped). */
    nav: {
        subnav?: 'expanded' | 'collapsed';
    };
    /** Contract violations found on the page (§6b); empty on a conforming page. */
    issues: CombIssue[];
}
export interface CombIssue {
    /** `duplicate-action`: the same action id is visible more than once on the page itself. */
    code: 'duplicate-action';
    id: string;
    count: number;
}
export interface CombInspector {
    version: number;
    page(): CombPageSnapshot | null;
    query(path: string, root?: ParentNode): Element[];
    snapshot(root?: Element): CombNode | null;
}
/**
 * Page-level actions (header, toolbar, regions, panels) must be unique: one "Assign member" per page.
 * Two visible actions with the same id outside rows/menus/overlays mean a section re-renders the
 * page's primary action — the header already owns it.
 */
export declare function combIssues(root: Element): CombIssue[];
declare global {
    interface Window {
        __comb?: CombInspector;
    }
}
/** Idempotent; safe to call from the Shell boot and from every page template. */
export declare function installCombInspector(target?: (Window & typeof globalThis) | undefined): CombInspector | undefined;
