import { describe, it, expect } from 'vitest';
import { isUuid, validateEmail, validatePhone, sanitizePhoneInput } from './validation';

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

describe('validateEmail', () => {
  describe('Given a valid email address', () => {
    it.each([
      'john.doe@gmail.com',
      'john_doe@company.co.in',
      'user+sales@example.com',
      'first-last@domain.org',
    ])('When "%s" is checked / Then it returns null', (email) => {
      expect(validateEmail(email)).toBeNull();
    });
  });

  describe('Given an email whose username contains a percent sign', () => {
    it('When "ab%c@gmail.com" is checked / Then it is rejected with the username guidance', () => {
      const msg = validateEmail('ab%c@gmail.com');
      expect(msg).not.toBeNull();
      expect(msg).toContain('Username may contain');
      expect(msg).not.toContain('percent');
    });
  });

  describe('Given an email with a malformed domain', () => {
    it('When the domain has consecutive hyphens (gm--ail.com) / Then it is rejected', () => {
      expect(validateEmail('shunma-8@gm--ail.com')).not.toBeNull();
      expect(validateEmail('abc@gm--ail.com')).not.toBeNull();
    });

    it('When the domain has consecutive periods / Then it is rejected', () => {
      expect(validateEmail('abc@gmail..com')).not.toBeNull();
    });

    it('When the domain starts with a period / Then it is rejected', () => {
      expect(validateEmail('abc@.gmail.com')).not.toBeNull();
    });

    it('When the domain is missing an extension / Then it is rejected', () => {
      expect(validateEmail('abc@gmail')).not.toBeNull();
      expect(validateEmail('abc@gmail.')).not.toBeNull();
    });
  });

  describe('Given an email with a malformed username', () => {
    it('When the username has consecutive periods / Then it is rejected', () => {
      expect(validateEmail('abc..123@gmail.com')).not.toBeNull();
    });

    it('When the "@" symbol is missing, doubled, or has no username/domain / Then it is rejected', () => {
      expect(validateEmail('abc')).not.toBeNull();
      expect(validateEmail('abc@')).not.toBeNull();
      expect(validateEmail('@gmail.com')).not.toBeNull();
      expect(validateEmail('abc@@gmail.com')).not.toBeNull();
    });

    it('When the address contains a space / Then it is rejected', () => {
      expect(validateEmail('abc @gmail.com')).not.toBeNull();
    });
  });

  describe('Given an empty value', () => {
    it('When not required / Then it returns null', () => {
      expect(validateEmail('')).toBeNull();
    });

    it('When required / Then it returns a message', () => {
      expect(validateEmail('', true)).toBe('Email is required.');
    });
  });
});

describe('sanitizePhoneInput', () => {
  describe('Given disallowed characters', () => {
    it('When the ticket\'s repro string is typed / Then everything but digits/-/() survives', () => {
      expect(sanitizePhoneInput('/(@$)(959599666666997979796462')).toBe('()(95959966666699797');
    });

    it('When letters and symbols like @ $ % & are present / Then they are stripped', () => {
      expect(sanitizePhoneInput('abc@555$123%456&')).toBe('555123456');
    });
  });

  describe('Given allowed characters', () => {
    it('When digits, spaces, +, -, ( ) are typed / Then they pass through unchanged', () => {
      expect(sanitizePhoneInput('+1 (555) 010-0100')).toBe('+1 (555) 010-0100');
    });
  });

  describe('Given an excessively long value', () => {
    it('When it exceeds 20 characters / Then it is truncated to 20', () => {
      const long = '1'.repeat(30);
      expect(sanitizePhoneInput(long)).toHaveLength(20);
    });
  });
});

describe('validatePhone', () => {
  describe('Given a well-formed number', () => {
    it.each(['+1 (555) 010-0100', '555-010-0100', '+971501234567'])('When "%s" is validated / Then it is accepted', (v) => {
      expect(validatePhone(v)).toBeNull();
    });
  });

  describe('Given too few or too many digits', () => {
    it('When fewer than 7 digits / Then the message says too short', () => {
      expect(validatePhone('12345')).toMatch(/too short/);
    });
    it('When more than 15 digits / Then the message says too long', () => {
      expect(validatePhone('1234567890123456')).toMatch(/too long/);
    });
  });

  describe('Given unbalanced parentheses', () => {
    it.each(['(555 010 0100', '555) 010 0100', '()5550100100', ')(5550100100'])('When "%s" is validated / Then it is rejected with the character message', (v) => {
      expect(validatePhone(v)).toMatch(/balanced/);
    });
  });

  describe('Given empty input', () => {
    it('When optional / Then null; when required / Then a required message', () => {
      expect(validatePhone('')).toBeNull();
      expect(validatePhone('', true)).toBe('Phone number is required.');
    });
  });
});

describe('validateEmail percent sign', () => {
  it('Given a % in the username / When validated / Then it is accepted (matches BE @IsEmail)', () => {
    expect(validateEmail('a%b@example.com')).toBeNull();
  });
  it('Given an invalid email / When validated / Then the message lists the percent sign as allowed', () => {
    expect(validateEmail('bad')).toMatch(/percent signs \(%\)/);
  });
});
