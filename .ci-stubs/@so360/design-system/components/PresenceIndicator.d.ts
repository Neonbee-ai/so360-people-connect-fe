import React from 'react';
export type PresenceState = 'viewing' | 'typing' | 'replying';
export interface PresenceViewer {
    id: string;
    name: string;
    avatarUrl?: string;
    state?: PresenceState;
}
export interface PresenceIndicatorProps {
    viewers: PresenceViewer[];
    /** Hidden from the list so you never see yourself. */
    currentUserId?: string;
    /** Avatars shown before "+N". Default 3. */
    max?: number;
    label?: string;
    variant?: 'default' | 'compact';
    name?: string;
    className?: string;
    'data-testid'?: string;
}
/** "Also viewing" strip: avatars, a names label, and a warning when someone else is replying. */
export declare const PresenceIndicator: React.FC<PresenceIndicatorProps>;
