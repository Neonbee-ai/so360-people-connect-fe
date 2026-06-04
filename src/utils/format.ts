/**
 * Utility functions for formatting values in the People Connect module.
 * These are presentation-only helpers - no business logic here.
 */

/**
 * Format a number as currency.
 *
 * @param amount   - Numeric value to format
 * @param currency - ISO 4217 currency code (default: 'USD'). Pass the org's
 *                   base_currency from business settings wherever available.
 * @param locale   - BCP 47 locale string (default: 'en-US'). Pass the org's
 *                   document_language from business settings wherever available.
 */
export function formatCurrency(amount: number, currency: string = 'USD', locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format a currency with decimals for detailed display.
 *
 * @param amount   - Numeric value to format
 * @param currency - ISO 4217 currency code (default: 'USD'). Pass the org's
 *                   base_currency from business settings wherever available.
 * @param locale   - BCP 47 locale string (default: 'en-US'). Pass the org's
 *                   document_language from business settings wherever available.
 */
export function formatCurrencyDetailed(amount: number, currency: string = 'USD', locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Format hours for display.
 */
export function formatHours(hours: number): string {
    if (hours === 0) return '0h';
    if (Number.isInteger(hours)) return `${hours}h`;
    return `${hours.toFixed(1)}h`;
}

/**
 * Format a date string to locale display.
 * Uses Intl.DateTimeFormat with UTC timezone to avoid off-by-one day shifts
 * caused by local timezone interpretation of date-only strings.
 */
export function formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(dateStr));
}

/**
 * Format a date to relative time (e.g., "2 hours ago").
 */
export function formatRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
}

/**
 * Get initials from a full name.
 */
export function getInitials(name: string): string {
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
}

/**
 * Format percentage for display.
 */
export function formatPercentage(value: number): string {
    if (Number.isInteger(value)) return `${value}%`;
    return `${value.toFixed(1)}%`;
}

/**
 * Get the current week's start date (Monday).
 */
export function getWeekStart(offset: number = 0): string {
    const now = new Date();
    now.setDate(now.getDate() + (offset * 7));
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now);
    start.setDate(diff);
    const y = start.getFullYear();
    const mo = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
}

/**
 * Get the current week's end date (Friday).
 */
export function getWeekEnd(offset: number = 0): string {
    const [y, m, d] = getWeekStart(offset).split('-').map(Number);
    const start = new Date(y, m - 1, d);
    start.setDate(start.getDate() + 4);
    const ey = start.getFullYear();
    const em = String(start.getMonth() + 1).padStart(2, '0');
    const ed = String(start.getDate()).padStart(2, '0');
    return `${ey}-${em}-${ed}`;
}
