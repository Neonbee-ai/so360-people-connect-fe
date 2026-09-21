import { describe, it, expect } from 'vitest';
import { parseUtcDate } from './datetime';

describe('Given parseUtcDate', () => {
  it('When given a naive "T" timestamp / Then it is interpreted as UTC', () => {
    const d = parseUtcDate('2026-06-03T14:54:00');
    expect(d.getTime()).toBe(Date.UTC(2026, 5, 3, 14, 54, 0));
  });

  it('When given the space-separated form / Then it is interpreted as the same UTC instant', () => {
    const d = parseUtcDate('2026-06-03 14:54:00');
    expect(d.getTime()).toBe(Date.UTC(2026, 5, 3, 14, 54, 0));
  });

  it('When the string already carries a trailing Z / Then it is left unchanged', () => {
    const d = parseUtcDate('2026-06-03T14:54:00Z');
    expect(d.getTime()).toBe(Date.UTC(2026, 5, 3, 14, 54, 0));
  });

  it('When the string carries a +05:30 offset / Then no Z is appended and the offset is honored', () => {
    const d = parseUtcDate('2026-06-03T14:54:00+05:30');
    expect(d.getTime()).toBe(Date.UTC(2026, 5, 3, 9, 24, 0));
  });

  it('When given a Date object / Then it is returned as-is', () => {
    const original = new Date('2026-06-03T14:54:00Z');
    expect(parseUtcDate(original)).toBe(original);
  });

  it('When given a date-only string / Then it resolves to UTC midnight', () => {
    const d = parseUtcDate('2026-06-03');
    expect(d.getTime()).toBe(Date.UTC(2026, 5, 3, 0, 0, 0));
  });

  it('When given an epoch number / Then it is treated as a millisecond timestamp', () => {
    const ms = Date.UTC(2026, 5, 3, 14, 54, 0);
    expect(parseUtcDate(ms).getTime()).toBe(ms);
  });

  it('When given null or undefined / Then it returns an Invalid Date', () => {
    expect(Number.isNaN(parseUtcDate(null).getTime())).toBe(true);
    expect(Number.isNaN(parseUtcDate(undefined).getTime())).toBe(true);
  });
});
