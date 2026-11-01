import { describe, it, expect } from 'vitest';
import { enumLabel } from './format';

describe('Given enumLabel()', () => {
    it('When given a lower-case value / Then it is title-cased', () => {
        expect(enumLabel('high')).toBe('High');
    });
    it('When given a snake_case value / Then underscores become spaces', () => {
        expect(enumLabel('on_leave')).toBe('On Leave');
    });
    it('When the value is missing / Then it returns an empty string', () => {
        expect(enumLabel(null)).toBe('');
        expect(enumLabel(undefined)).toBe('');
        expect(enumLabel('')).toBe('');
    });
});
