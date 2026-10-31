import type { Holiday } from '../services/holidaysService';

/** Case-insensitive search over name, region, state and country. */
export function filterHolidaysBySearch(holidays: Holiday[], query: string): Holiday[] {
  const q = query.trim().toLowerCase();
  if (!q) return holidays;
  return holidays.filter(h =>
    [h.name, h.region, h.state, h.country].some(v => (v ?? '').toLowerCase().includes(q)),
  );
}

/** Seed for "Duplicate": same details, name marked as a copy, date left blank so the admin picks it. */
export function duplicateSeed(h: Holiday): Holiday {
  return { ...h, id: '', name: `${h.name} (copy)`, holiday_date: '' };
}

/** Holidays as DS EventCalendar events (all-day, keyed by holiday id). */
export function holidayEvents(
  holidays: Holiday[],
  toneOf: (h: Holiday) => 'primary' | 'info' | 'neutral' | 'warning' = () => 'primary',
): Array<{ id: string; title: string; start: string; tone: 'primary' | 'info' | 'neutral' | 'warning' }> {
  return holidays
    .filter(h => !!h.holiday_date)
    .map(h => ({ id: h.id, title: h.name, start: h.holiday_date.slice(0, 10), tone: toneOf(h) }));
}
