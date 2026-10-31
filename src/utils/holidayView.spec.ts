import { describe, it, expect } from 'vitest';
import { filterHolidaysBySearch, duplicateSeed, monthCells } from './holidayView';

const h = (o: any) => ({ id: 'a', name: 'Diwali', holiday_date: '2026-11-08', holiday_type: 'public', region: 'North', state: null, country: 'IN', ...o }) as any;

describe('holiday view helpers', () => {
  it('given a query, when filtering, then matches name/region case-insensitively', () => {
    const list = [h({}), h({ id: 'b', name: 'Christmas', region: 'West' })];
    expect(filterHolidaysBySearch(list, 'dIw')).toHaveLength(1);
    expect(filterHolidaysBySearch(list, 'west')[0].name).toBe('Christmas');
  });
  it('given blank query, then returns all', () => {
    expect(filterHolidaysBySearch([h({}), h({ id: 'b' })], '  ')).toHaveLength(2);
  });
  it('given a holiday, when duplicating, then id and date are cleared and name marked copy', () => {
    const d = duplicateSeed(h({}));
    expect(d).toMatchObject({ id: '', holiday_date: '', name: 'Diwali (copy)', region: 'North' });
  });
  it('given Nov 2026, when building cells, then pads to Sunday-first and flags the holiday day', () => {
    const cells = monthCells(2026, 10, [h({})]);
    expect(cells.filter(c => c === null)).toHaveLength(0); // Nov 1 2026 is Sunday
    expect(cells).toHaveLength(30);
    expect(cells[7]!.items).toHaveLength(1);
  });
});
