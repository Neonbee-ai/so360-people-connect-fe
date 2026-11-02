import { describe, it, expect } from 'vitest';
import { isContractorEmploymentType, personTypeForEmploymentType, typeToSendOnEdit } from './personType';

/**
 * Per-org contractor flag on Employment Type masters (b1178b3f AC2).
 * A boolean `is_contractor` on the org's master wins; null/missing keeps the
 * built-in code default, matching the backend.
 */
describe('Employment type contractor flag', () => {
  const masters = [
    { code: 'contract', is_contractor: false },
    { code: 'agency_staff', is_contractor: true },
    { code: 'freelancer', is_contractor: null },
  ];

  it('Given the org marks a default-contractor code as employee / When deriving / Then the person is an employee', () => {
    expect(personTypeForEmploymentType('contract', 'employee', masters)).toBe('employee');
  });

  it('Given the org marks an org-created code as contractor / When deriving / Then the person is a contractor', () => {
    expect(personTypeForEmploymentType('Agency_Staff', 'employee', masters)).toBe('contractor');
  });

  it('Given the flag is null / When deriving / Then the code default applies', () => {
    expect(isContractorEmploymentType('freelancer', masters)).toBe(true);
  });

  it('Given the code is not in the masters list / When deriving / Then the code default applies', () => {
    expect(isContractorEmploymentType('full_time', masters)).toBe(false);
    expect(isContractorEmploymentType('consultant', masters)).toBe(true);
  });

  it('Given no masters are loaded / When deriving / Then behaviour is unchanged', () => {
    expect(personTypeForEmploymentType('contract')).toBe('contractor');
  });

  it('Given an edit to an org-flagged contractor code / When saving / Then the type change is sent', () => {
    expect(typeToSendOnEdit('full_time', 'agency_staff', 'employee', masters)).toBe('contractor');
  });

  it('Given an edit to a code the org flags as employee / When the stored type is employee / Then no type is sent', () => {
    expect(typeToSendOnEdit('full_time', 'contract', 'employee', masters)).toBeUndefined();
  });
});
