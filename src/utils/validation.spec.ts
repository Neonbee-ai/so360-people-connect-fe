import { describe, it, expect } from 'vitest';
import { isUuid } from './validation';

describe('isUuid', () => {
  describe('Given a syntactically valid UUID', () => {
    it('When a lowercase v4 UUID is checked / Then it returns true', () => {
      expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('When the UUID is uppercase / Then it is accepted case-insensitively', () => {
      expect(isUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('When the UUID has surrounding whitespace / Then it is trimmed and accepted', () => {
      expect(isUuid('  550e8400-e29b-41d4-a716-446655440000  ')).toBe(true);
    });

    it('When other RFC-4122 versions/variants are used / Then they are accepted', () => {
      // version 1, variant 8/9/a/b
      expect(isUuid('11111111-1111-1111-9111-111111111111')).toBe(true);
      expect(isUuid('22222222-2222-5222-b222-222222222222')).toBe(true);
    });
  });

  describe('Given an invalid entity id', () => {
    it('When a display id like "proj-001" is checked / Then it returns false', () => {
      expect(isUuid('proj-001')).toBe(false);
    });

    it('When the string is empty / Then it returns false', () => {
      expect(isUuid('')).toBe(false);
      expect(isUuid('   ')).toBe(false);
    });

    it('When segment lengths are wrong / Then it returns false', () => {
      expect(isUuid('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // last group too short
      expect(isUuid('550e8400e29b41d4a716446655440000')).toBe(false); // no dashes
    });

    it('When the version or variant nibble is invalid / Then it returns false', () => {
      expect(isUuid('11111111-1111-6111-8111-111111111111')).toBe(false); // version 6 not in [1-5]
      expect(isUuid('11111111-1111-4111-c111-111111111111')).toBe(false); // variant c not in [89ab]
    });

    it('When it contains non-hex characters / Then it returns false', () => {
      expect(isUuid('zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz')).toBe(false);
    });
  });

  describe('Given a non-string value', () => {
    it('When null/undefined/number/object are checked / Then it returns false', () => {
      expect(isUuid(null)).toBe(false);
      expect(isUuid(undefined)).toBe(false);
      expect(isUuid(12345)).toBe(false);
      expect(isUuid({})).toBe(false);
      expect(isUuid(['550e8400-e29b-41d4-a716-446655440000'])).toBe(false);
    });
  });
});
