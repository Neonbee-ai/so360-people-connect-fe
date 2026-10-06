import { useCallback, useEffect, useRef } from 'react';

/** Never refetch more often than this, however often focus changes. */
export const REFRESH_ON_RETURN_MIN_INTERVAL_MS = 30_000;

/**
 * Re-reads data once the user comes back from a page they were sent to in a
 * new tab (e.g. "Create Employment Type"), instead of on every focus change.
 *
 * Call the returned `markPending` when the link is clicked. The next
 * focus / tab-visible event while `enabled` consumes the flag and calls
 * `refresh`. Focus events with no pending flag do nothing, and a refresh is
 * skipped (flag kept) if one already ran within `minIntervalMs`.
 */
export const useRefreshOnReturn = (
  enabled: boolean,
  refresh: () => void,
  minIntervalMs: number = REFRESH_ON_RETURN_MIN_INTERVAL_MS,
): (() => void) => {
  const pending = useRef(false);
  const lastRun = useRef(0);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) {
      pending.current = false;
      return;
    }
    const onReturn = () => {
      if (!pending.current) return;
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastRun.current < minIntervalMs) return;
      pending.current = false;
      lastRun.current = now;
      refreshRef.current();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [enabled, minIntervalMs]);

  return useCallback(() => {
    pending.current = true;
  }, []);
};
