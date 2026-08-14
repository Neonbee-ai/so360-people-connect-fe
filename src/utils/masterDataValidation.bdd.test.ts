import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validatePersonName,
  validateEmail,
  validatePhone,
  validateDepartmentCode,
  validateDepartmentName,
  todayIso,
  focusFirstInvalid,
} from './validation';

describe('Given the Full Name field on Add Person', () => {
  it('When a normal name is entered / Then it is accepted', () => {
    expect(validatePersonName('John Doe')).toBeNull();
    expect(validatePersonName("Mary-Jane O'Neill")).toBeNull();
    expect(validatePersonName('Dr. Sarah Vance')).toBeNull();
    expect(validatePersonName('José Álvarez')).toBeNull();
  });

  it('When the reported junk value "897+46+4+61" is entered / Then it is rejected', () => {
    expect(validatePersonName('897+46+4+61')).toBeTruthy();
  });

  it('When the value is digits or symbols only / Then it is rejected', () => {
    expect(validatePersonName('12345')).toBeTruthy();
    expect(validatePersonName('!!!@@@')).toBeTruthy();
  });

  it('When a name contains embedded digits / Then it is rejected', () => {
    expect(validatePersonName('John2 Doe')).toBeTruthy();
  });

  it('When the field is empty or whitespace / Then a required message is returned', () => {
    expect(validatePersonName('')).toBe('Full name is required.');
    expect(validatePersonName('   ')).toBe('Full name is required.');
  });

  it('When the name is a single character / Then it is rejected as too short', () => {
    expect(validatePersonName('A')).toContain('at least 2');
  });

  it('When the name exceeds 100 characters / Then it is rejected as too long', () => {
    expect(validatePersonName('a'.repeat(101))).toContain('100 characters');
  });

  it('When the name has padding whitespace / Then it is trimmed before validating', () => {
    expect(validatePersonName('  John Doe  ')).toBeNull();
  });
});

describe('Given the Email field on Add Person', () => {
  it('When a valid address is entered / Then it is accepted', () => {
    expect(validateEmail('henry@gmail.com')).toBeNull();
    expect(validateEmail('first.last+tag@sub.example.co.uk')).toBeNull();
  });

  it('When the reported junk value "henry@gmail.com74166^(*)_)" is entered / Then it is rejected', () => {
    expect(validateEmail('henry@gmail.com74166^(*)_)')).toBe('Please enter a valid email address.');
  });

  it('When the address is malformed / Then it is rejected', () => {
    expect(validateEmail('no-at-sign.com')).toBeTruthy();
    expect(validateEmail('two@@example.com')).toBeTruthy();
    expect(validateEmail('trailing@example')).toBeTruthy();
    expect(validateEmail('spaced address@example.com')).toBeTruthy();
  });

  it('When the field is empty and optional / Then it is accepted', () => {
    expect(validateEmail('')).toBeNull();
  });

  it('When the field is empty and required / Then a required message is returned', () => {
    expect(validateEmail('', true)).toBe('Email is required.');
  });
});

describe('Given the Phone field on Add Person', () => {
  it('When a valid number is entered / Then it is accepted', () => {
    expect(validatePhone('+1-555-0100')).toBeNull();
    expect(validatePhone('+91 98765 43210')).toBeNull();
    expect(validatePhone('(020) 7946 0958')).toBeNull();
  });

  it('When the reported junk value "*745dsdhkdklmdhdj/*/@#$" is entered / Then it is rejected', () => {
    expect(validatePhone('*745dsdhkdklmdhdj/*/@#$')).toBeTruthy();
  });

  it('When the value contains letters / Then it is rejected', () => {
    expect(validatePhone('555-CALL-NOW')).toBeTruthy();
  });

  it('When there are too few or too many digits / Then it is rejected', () => {
    expect(validatePhone('12345')).toContain('7 and 15');
    expect(validatePhone('1234567890123456')).toContain('7 and 15');
  });

  it('When the field is empty and optional / Then it is accepted', () => {
    expect(validatePhone('')).toBeNull();
  });
});

describe('Given the Department Code field', () => {
  it('When a business-friendly code is entered / Then it is accepted', () => {
    expect(validateDepartmentCode('QA')).toBeNull();
    expect(validateDepartmentCode('ENG')).toBeNull();
    expect(validateDepartmentCode('HR-01')).toBeNull();
    expect(validateDepartmentCode('OPS_EU')).toBeNull();
  });

  it('When the reported junk value "878965%(%%(&(%P0" is entered / Then it is rejected', () => {
    expect(validateDepartmentCode('878965%(%%(&(%P0')).toBeTruthy();
  });

  it('When the code contains spaces or symbols / Then it is rejected', () => {
    expect(validateDepartmentCode('ENG TEAM')).toBeTruthy();
    expect(validateDepartmentCode('ENG!')).toBeTruthy();
  });

  it('When the code is out of the 2–20 length range / Then it is rejected', () => {
    expect(validateDepartmentCode('E')).toContain('at least 2');
    expect(validateDepartmentCode('E'.repeat(21))).toContain('20 characters');
  });

  it('When the field is empty / Then a required message is returned', () => {
    expect(validateDepartmentCode('')).toBe('Department code is required.');
  });
});

describe('Given the Department Name field', () => {
  it('When a legitimate department name is entered / Then it is accepted', () => {
    expect(validateDepartmentName('QA Department')).toBeNull();
    expect(validateDepartmentName('Engineering & Development')).toBeNull();
    expect(validateDepartmentName('R&D')).toBeNull();
    expect(validateDepartmentName('Sales (EMEA)')).toBeNull();
  });

  it('When the reported junk value "5464687987&(&%&*^(" is entered / Then it is rejected', () => {
    expect(validateDepartmentName('5464687987&(&%&*^(')).toBeTruthy();
  });

  it('When the name is numbers only / Then it is rejected for having no letters', () => {
    expect(validateDepartmentName('12345')).toBe('Please enter a valid department name.');
  });

  it('When the field is empty / Then a required message is returned', () => {
    expect(validateDepartmentName('   ')).toBe('Department name is required.');
  });
});

describe('Given todayIso()', () => {
  afterEach(() => vi.useRealTimers());

  it('When called / Then it returns the local calendar date, not the UTC one', () => {
    // 22:30 UTC falls on a different calendar day than local time in any zone
    // east of UTC+1:30 — exactly the case where a naive toISOString() would
    // report yesterday and make "today" look like a past date to the form.
    vi.useFakeTimers();
    const now = new Date('2026-08-14T22:30:00Z');
    vi.setSystemTime(now);
    const localDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // todayIso must agree with the browser's own local calendar day.
    expect(todayIso()).toBe(localDay);
  });
});

describe('Given a submitted form with invalid fields', () => {
  it('When focusFirstInvalid runs / Then the first invalid control in submit order is scrolled to and focused', () => {
    const form = document.createElement('form');
    const nameInput = document.createElement('input');
    nameInput.dataset.field = 'full_name';
    const emailInput = document.createElement('input');
    emailInput.dataset.field = 'email';
    form.append(nameInput, emailInput);
    document.body.append(form);
    nameInput.scrollIntoView = vi.fn();
    emailInput.scrollIntoView = vi.fn();

    focusFirstInvalid(form, ['full_name', 'email'], { full_name: 'bad', email: 'also bad' });

    expect(nameInput.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(nameInput);
    expect(emailInput.scrollIntoView).not.toHaveBeenCalled();
    form.remove();
  });

  it('When only a later field is invalid / Then that field is the one focused', () => {
    const form = document.createElement('form');
    const nameInput = document.createElement('input');
    nameInput.dataset.field = 'full_name';
    const emailInput = document.createElement('input');
    emailInput.dataset.field = 'email';
    form.append(nameInput, emailInput);
    document.body.append(form);
    emailInput.scrollIntoView = vi.fn();

    focusFirstInvalid(form, ['full_name', 'email'], { full_name: '', email: 'bad' });

    expect(document.activeElement).toBe(emailInput);
    form.remove();
  });

  it('When nothing is invalid / Then focus is left alone', () => {
    const form = document.createElement('form');
    document.body.append(form);
    expect(() => focusFirstInvalid(form, ['full_name'], {})).not.toThrow();
    form.remove();
  });
});
