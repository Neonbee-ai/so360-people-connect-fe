/**
 * Utility functions for formatting values in the People Connect module.
 * These are presentation-only helpers - no business logic here.
 */

/**
 * Format a number as currency.
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format a currency with decimals for detailed display.
 */
export function formatCurrencyDetailed(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
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
 */
export function formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
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
    return start.toISOString().split('T')[0];
}

/**
 * Get the current week's end date (Friday).
 */
export function getWeekEnd(offset: number = 0): string {
    const start = new Date(getWeekStart(offset));
    start.setDate(start.getDate() + 4);
    return start.toISOString().split('T')[0];
}
