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
} from '../utils/format';

describe('format utilities', () => {
  describe('formatCurrency', () => {
    it('Given a number / Then it returns USD currency string without decimals', () => {
      expect(formatCurrency(1500)).toBe('$1,500');
    });

    it('Given a number and EUR / Then it returns EUR currency string', () => {
      expect(formatCurrency(1500, 'EUR')).toContain('1,500');
    });

    it('Given zero / Then it returns $0', () => {
      expect(formatCurrency(0)).toBe('$0');
    });
  });

  describe('formatCurrencyDetailed', () => {
    it('Given a number / Then it returns USD with 2 decimal places', () => {
      expect(formatCurrencyDetailed(1500.5)).toBe('$1,500.50');
    });

    it('Given zero / Then it returns $0.00', () => {
      expect(formatCurrencyDetailed(0)).toBe('$0.00');
    });
  });

  describe('formatHours', () => {
    it('Given 0 / Then it returns 0h', () => {
      expect(formatHours(0)).toBe('0h');
    });

    it('Given an integer / Then it returns Nh', () => {
      expect(formatHours(8)).toBe('8h');
    });

    it('Given a fractional number / Then it returns N.Xh', () => {
      expect(formatHours(7.5)).toBe('7.5h');
    });
  });

  describe('formatDate', () => {
    it('Given a valid ISO date / Then it returns formatted date', () => {
      const result = formatDate('2025-06-15');
      expect(result).toContain('Jun');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('Given an empty string / Then it returns dash', () => {
      expect(formatDate('')).toBe('-');
    });
  });

  describe('formatRelativeTime', () => {
    it('Given a date just now / Then it returns Just now', () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe('Just now');
    });

    it('Given a date 5 minutes ago / Then it returns 5m ago', () => {
      const d = new Date(Date.now() - 5 * 60000).toISOString();
      expect(formatRelativeTime(d)).toBe('5m ago');
    });

    it('Given a date 3 hours ago / Then it returns 3h ago', () => {
      const d = new Date(Date.now() - 3 * 3600000).toISOString();
      expect(formatRelativeTime(d)).toBe('3h ago');
    });

    it('Given a date 2 days ago / Then it returns 2d ago', () => {
      const d = new Date(Date.now() - 2 * 86400000).toISOString();
      expect(formatRelativeTime(d)).toBe('2d ago');
    });

    it('Given a date 10 days ago / Then it returns a formatted date', () => {
      const d = new Date(Date.now() - 10 * 86400000).toISOString();
      const result = formatRelativeTime(d);
      expect(result).not.toContain('ago');
    });
  });

  describe('getInitials', () => {
    it('Given a full name / Then it returns uppercase initials', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('Given a single name / Then it returns one letter', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('Given three names / Then it returns first two initials', () => {
      expect(getInitials('John Michael Doe')).toBe('JM');
    });
  });

  describe('formatPercentage', () => {
    it('Given an integer / Then it returns N%', () => {
      expect(formatPercentage(75)).toBe('75%');
    });

    it('Given a decimal / Then it returns N.X%', () => {
      expect(formatPercentage(75.55)).toBe('75.5%');
    });
  });

  describe('getWeekStart', () => {
    it('Given no offset / Then it returns a valid date string', () => {
      const result = getWeekStart();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('Given offset -1 / Then it returns a date before this week', () => {
      const thisWeek = new Date(getWeekStart()).getTime();
      const lastWeek = new Date(getWeekStart(-1)).getTime();
      expect(lastWeek).toBeLessThan(thisWeek);
    });
  });

  describe('getWeekEnd', () => {
    it('Given no offset / Then it returns a valid date string', () => {
      const result = getWeekEnd();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('Given same offset / Then end is 4 days after start', () => {
      const start = new Date(getWeekStart()).getTime();
      const end = new Date(getWeekEnd()).getTime();
      expect(end - start).toBe(4 * 86400000);
    });
  });
});
