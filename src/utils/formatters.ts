import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters as useFormattersBase } from '@so360/formatters';

/**
 * People Connect formatters hook.
 * Binds the shared @so360/formatters hook to the current org's
 * currency, locale, and timezone from business settings.
 *
 * Use this instead of calling toLocaleDateString / toLocaleString directly.
 *
 * @example
 *   const formatters = usePeopleFormatters();
 *   formatters.formatDate(person.hire_date)
 *   formatters.formatDateTime(event.occurred_at)
 */
export function usePeopleFormatters() {
    const { settings } = useBusinessSettings();
    return useFormattersBase({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });
}
