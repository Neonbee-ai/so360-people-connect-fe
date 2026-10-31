/**
 * Client-side leave balance pre-check. The backend stays authoritative (it
 * rejects over-balance requests); this only gives an inline early warning.
 *
 * Counts Mon-Fri days in the range, minus half-days. That is a LOWER bound on
 * the server's working-day count (holidays can only reduce it further), so the
 * form never blocks a request the server would accept.
 */
export function minWorkingDays(
    start: string,
    end: string,
    halfStart = false,
    halfEnd = false,
): number | null {
    if (!start || !end || end < start) return null;
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    let n = 0;
    for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) n += 1;
    }
    if (halfStart) n -= 0.5;
    if (halfEnd && start !== end) n -= 0.5;
    return Math.max(n, 0);
}

/** Returns an error message when the request exceeds the remaining balance. */
export function balanceError(
    available: number | undefined | null,
    days: number | null,
): string {
    if (available == null || days == null) return '';
    if (days > available) {
        return `Requested ${days} day(s) exceeds your remaining balance of ${available} day(s).`;
    }
    return '';
}
