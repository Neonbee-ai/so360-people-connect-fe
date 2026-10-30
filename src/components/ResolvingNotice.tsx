import React, { useEffect, useState } from 'react';

/** How long shell context may take before we stop spinning and offer a retry. */
export const RESOLVE_TIMEOUT_MS = 20000;

/**
 * Visible, bounded "waiting on the shell" state.
 *
 * Replaces the bare `null` that route guards returned while entitlements
 * resolved: a slow Core call left People pages blank indefinitely, which reads
 * as a hang. Spins first, then after RESOLVE_TIMEOUT_MS shows an explanatory
 * message with a retry instead of waiting forever.
 */
export const ResolvingNotice: React.FC<{ label?: string; timeoutMs?: number }> = ({
    label = 'Loading…',
    timeoutMs = RESOLVE_TIMEOUT_MS,
}) => {
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setTimedOut(true), timeoutMs);
        return () => clearTimeout(t);
    }, [timeoutMs]);

    if (timedOut) {
        return (
            <div role="alert" className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center px-4">
                <h2 className="text-lg font-semibold text-fg">This is taking longer than expected</h2>
                <p className="text-sm text-fg-subtle max-w-md">We could not load your workspace context. Check your connection and try again.</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div role="status" className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-fg-muted">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm">{label}</p>
        </div>
    );
};

export default ResolvingNotice;
