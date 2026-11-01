import { describe, it, expect } from 'vitest';
import { filterHolidaysBySearch, duplicateSeed, holidayEvents } from './holidayView';

const h = (over: any = {}) => ({ id: 'h1', name: 'Republic Day', holiday_date: '2030-01-26T00:00:00', holiday_type: 'national', is_optional: false, is_mandatory: true, ...over });

describe('holidayView (8df0cba8)', () => {
  it('Given a blank query / When filtering / Then every holiday is kept', () => {
    expect(filterHolidaysBySearch([h(), h({ id: 'h2' })] as any, '  ')).toHaveLength(2);
  });
  it('Given a query matching name, region, state or country / When filtering / Then only matches stay (case-insensitive)', () => {
    const list = [h(), h({ id: 'h2', name: 'Onam', state: 'Kerala' }), h({ id: 'h3', name: 'Eid', country: 'UAE' })] as any;
    expect(filterHolidaysBySearch(list, 'kerala').map(x => x.id)).toEqual(['h2']);
    expect(filterHolidaysBySearch(list, 'REPUBLIC').map(x => x.id)).toEqual(['h1']);
    expect(filterHolidaysBySearch(list, 'uae').map(x => x.id)).toEqual(['h3']);
  });
  it('Given a holiday / When duplicating / Then the seed has no id, a copy name and a blank date', () => {
    const s = duplicateSeed(h({ state: 'Kerala' }) as any);
    expect(s).toMatchObject({ id: '', name: 'Republic Day (copy)', holiday_date: '', state: 'Kerala', holiday_type: 'national' });
  });
  it('Given holidays / When mapped to calendar events / Then each has a date-only start and the tone given', () => {
    const ev = holidayEvents([h(), h({ id: 'h2', holiday_date: '' })] as any, () => 'info');
    expect(ev).toEqual([{ id: 'h1', title: 'Republic Day', start: '2030-01-26', tone: 'info' }]);
  });
});
