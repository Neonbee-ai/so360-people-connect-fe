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

/** Calendar cells (Sun-first) for a month; null pads leading blanks. */
export function monthCells(year: number, month: number, holidays: Holiday[]): Array<{ day: number; items: Holiday[] } | null> {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; items: Holiday[] } | null> = Array(first).fill(null);
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, items: holidays.filter(h => h.holiday_date.slice(0, 10) === iso) });
  }
  return cells;
}
