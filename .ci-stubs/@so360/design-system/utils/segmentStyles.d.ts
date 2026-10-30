/**
 * Shared look for segmented tracks (SegmentedControl, ToggleGroup, pill Tabs): a muted sunken track and
 * an "on" thumb that reads as selected — selected-token fill (≥1.4:1 vs surface), primary/60 border,
 * semibold selected-fg text and a level-1 shadow so the thumb lifts off the track in both themes.
 */
export declare const SEGMENT_TRACK = "rounded-nb border border-line bg-surface-sunken p-0.5";
export declare const SEGMENT_ON = "border border-primary/60 bg-selected font-semibold text-selected-fg shadow-nb-1";
export declare const SEGMENT_OFF = "border border-transparent text-fg-muted enabled:hover:bg-fg/state-hover enabled:hover:text-fg enabled:active:bg-fg/state-pressed";
export declare const SEGMENT_FOCUS_OFFSET = "focus-visible:ring-offset-surface-sunken";
