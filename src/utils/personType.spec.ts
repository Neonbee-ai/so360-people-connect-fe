import { describe, it, expect } from 'vitest';
import { personTypeForEmploymentType, personTypeLabel, typeToSendOnEdit, CONTRACTOR_EMPLOYMENT_TYPE_CODES } from './personType';

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

describe('personTypeForEmploymentType decisions (PR 34)', () => {
  it('Given the "consultant" employment type / Then the person type is contractor, never consultant', () => {
    expect(personTypeForEmploymentType('consultant')).toBe('contractor');
    expect(personTypeForEmploymentType('consultant', 'consultant')).toBe('contractor');
  });

  it('Given the seeded "temporary" code / Then the person is an employee (headcount, leave, payroll)', () => {
    expect(personTypeForEmploymentType('temporary')).toBe('employee');
    expect(personTypeForEmploymentType('temporary', 'contractor')).toBe('employee');
  });

  it('Given no employment type and a legacy stored consultant / Then the stored type is kept', () => {
    expect(personTypeForEmploymentType(undefined, 'consultant')).toBe('consultant');
  });
});

describe('typeToSendOnEdit', () => {
  it('Given a legacy stored consultant whose employment type changes to a contractor-style code / Then contractor is sent', () => {
    expect(typeToSendOnEdit('contract', 'freelancer', 'consultant')).toBe('contractor');
  });

  it('Given the employment type is unchanged / Then no type is sent, even if the stored type disagrees', () => {
    expect(typeToSendOnEdit('freelancer', 'freelancer', 'employee')).toBeUndefined();
    expect(typeToSendOnEdit(undefined, '', 'consultant')).toBeUndefined();
    expect(typeToSendOnEdit(null, undefined, 'contractor')).toBeUndefined();
  });

  it('Given the employment type was cleared / Then no type is sent', () => {
    expect(typeToSendOnEdit('freelancer', undefined, 'contractor')).toBeUndefined();
  });

  it('Given the employment type changed and implies a different type / Then that type is sent', () => {
    expect(typeToSendOnEdit('full_time', 'freelancer', 'employee')).toBe('contractor');
    expect(typeToSendOnEdit('freelancer', 'full_time', 'consultant')).toBe('employee');
    expect(typeToSendOnEdit('full_time', 'temporary', 'contractor')).toBe('employee');
    expect(typeToSendOnEdit('full_time', 'consultant', 'employee')).toBe('contractor');
  });

  it('Given the employment type changed but implies the stored type / Then no type is sent', () => {
    expect(typeToSendOnEdit('contract', 'freelancer', 'contractor')).toBeUndefined();
    expect(typeToSendOnEdit(undefined, 'full_time', 'employee')).toBeUndefined();
  });
});

describe('personTypeLabel', () => {
  it('Given consultant / Then "Consultant"', () => {
    expect(personTypeLabel('consultant')).toBe('Consultant');
  });

  it('Given contractor / Then "Contractor"', () => {
    expect(personTypeLabel('contractor')).toBe('Contractor');
  });

  it('Given employee / Then "Employee"', () => {
    expect(personTypeLabel('employee')).toBe('Employee');
  });
});
