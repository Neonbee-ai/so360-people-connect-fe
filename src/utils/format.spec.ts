import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyDetailed,
  formatHours,
  formatDate,
  formatRelativeTime,
  getInitials,
  formatPercentage,
  getWeekStart,
  getWeekEnd,
} from './format';

describe('Given formatCurrency', () => {
  it('When called with a whole number / Then it formats as USD by default', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
  });

  it('When called with a large number / Then it adds comma separators', () => {
    expect(formatCurrency(50000)).toBe('$50,000');
  });

  it('When called with EUR currency / Then it formats in EUR', () => {
    const result = formatCurrency(500, 'EUR');
    expect(result).toContain('500');
    expect(result).toMatch(/€|EUR/);
  });

  it('When called with zero / Then it shows $0', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
});

describe('Given formatCurrencyDetailed', () => {
  it('When called / Then it shows two decimal places', () => {
    expect(formatCurrency(100)).not.toContain('.');
    expect(formatCurrencyDetailed(100)).toContain('.00');
  });

  it('When called with a decimal amount / Then it shows exact cents', () => {
    const result = formatCurrencyDetailed(99.99);
    expect(result).toContain('99.99');
  });
});

describe('Given formatHours', () => {
  it('When hours is 0 / Then it returns "0h"', () => {
    expect(formatHours(0)).toBe('0h');
  });

  it('When hours is a whole integer / Then it returns Nh without decimal', () => {
    expect(formatHours(8)).toBe('8h');
  });

  it('When hours has a decimal / Then it returns 1 decimal place', () => {
    expect(formatHours(7.5)).toBe('7.5h');
  });

  it('When hours is 40 / Then it returns "40h"', () => {
    expect(formatHours(40)).toBe('40h');
  });
});

describe('Given formatDate', () => {
  it('When a valid ISO date string is passed / Then it returns a human-readable date', () => {
    const result = formatDate('2024-06-15');
    expect(result).toMatch(/Jun|June/);
    expect(result).toContain('2024');
  });

  it('When an empty string is passed / Then it returns "-"', () => {
    expect(formatDate('')).toBe('-');
  });
});

describe('Given formatRelativeTime', () => {
  it('When date is very recent / Then it returns "Just now"', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('Just now');
  });

  it('When date was 30 minutes ago / Then it returns "30m ago"', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(formatRelativeTime(thirtyMinAgo)).toBe('30m ago');
  });

  it('When date was 3 hours ago / Then it returns "3h ago"', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('When date was 2 days ago / Then it returns "2d ago"', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });
});

describe('Given getInitials', () => {
  it('When full name is provided / Then it returns up to 2 initials', () => {
    expect(getInitials('Alice Smith')).toBe('AS');
  });

  it('When single name is provided / Then it returns 1 initial', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('When three-word name is provided / Then it returns first 2 initials', () => {
    expect(getInitials('John Middle Smith')).toBe('JM');
  });

  it('When name is lowercase / Then initials are uppercased', () => {
    expect(getInitials('alice smith')).toBe('AS');
  });
});

describe('Given formatPercentage', () => {
  it('When value is a whole integer / Then it appends % without decimal', () => {
    expect(formatPercentage(75)).toBe('75%');
  });

  it('When value is a decimal / Then it shows 1 decimal place', () => {
    expect(formatPercentage(72.5)).toBe('72.5%');
  });

  it('When value is 0 / Then it returns "0%"', () => {
    expect(formatPercentage(0)).toBe('0%');
  });

  it('When value is 100 / Then it returns "100%"', () => {
    expect(formatPercentage(100)).toBe('100%');
  });
});

describe('Given getWeekStart and getWeekEnd', () => {
  it('When getWeekStart is called with no offset / Then it returns a Monday date string', () => {
    const result = getWeekStart();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [y, m, d] = result.split('-').map(Number);
    const day = new Date(y, m - 1, d).getDay();
    expect(day).toBe(1); // Monday
  });

  it('When getWeekEnd is called / Then it returns a Friday (4 days after Monday)', () => {
    const start = new Date(getWeekStart());
    const end = new Date(getWeekEnd());
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(4);
  });
});
