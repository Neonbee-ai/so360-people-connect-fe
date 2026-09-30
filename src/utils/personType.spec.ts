import { describe, it, expect } from 'vitest';
import { personTypeForEmploymentType, personTypeLabel, CONTRACTOR_EMPLOYMENT_TYPE_CODES } from './personType';

/**
 * personType — BDD specs. Employee vs Contractor is derived from the
 * Employment Type code so the Add/Edit Person forms need only one input.
 */
describe('personTypeForEmploymentType', () => {
  it.each(['contract', 'contractor', 'consultant', 'freelancer'])(
    'Given the contractor-style code "%s" / Then the person is a contractor',
    code => {
      expect(personTypeForEmploymentType(code)).toBe('contractor');
    },
  );

  it.each(['full_time', 'part_time', 'intern', 'temporary', 'agency_staff'])(
    'Given the code "%s" / Then the person is an employee',
    code => {
      expect(personTypeForEmploymentType(code)).toBe('employee');
    },
  );

  it('Given a code in a different case / Then it still matches', () => {
    expect(personTypeForEmploymentType('Freelancer')).toBe('contractor');
  });

  it.each([undefined, null, ''])(
    'Given no employment type (%s) and no fallback / Then the person is an employee',
    code => {
      expect(personTypeForEmploymentType(code)).toBe('employee');
    },
  );

  it('Given no employment type and a stored contractor fallback / Then the stored type is kept', () => {
    expect(personTypeForEmploymentType(undefined, 'contractor')).toBe('contractor');
  });

  it('Given an employment type and a fallback / Then the employment type wins', () => {
    expect(personTypeForEmploymentType('full_time', 'contractor')).toBe('employee');
  });

  it('Then the contractor codes are exactly the seeded contractor-style types plus "contractor"', () => {
    expect([...CONTRACTOR_EMPLOYMENT_TYPE_CODES].sort()).toEqual(['consultant', 'contract', 'contractor', 'freelancer']);
  });
});

describe('personTypeLabel', () => {
  it('Given contractor / Then "Contractor"', () => {
    expect(personTypeLabel('contractor')).toBe('Contractor');
  });

  it('Given employee / Then "Employee"', () => {
    expect(personTypeLabel('employee')).toBe('Employee');
  });
});
