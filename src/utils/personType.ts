/**
 * Employee vs Contractor is derived from the Employment Type, so HR picks one
 * field instead of two that could contradict each other (Type = Employee with
 * Employment Type = Freelancer was accepted before).
 *
 * Keyed on the master's CODE, which is what `people.employment_type` stores.
 * The seeded contractor-style codes are listed here; any other code — including
 * org-created employment types — counts as an employee.
 */
export type PersonType = 'employee' | 'contractor';

export const CONTRACTOR_EMPLOYMENT_TYPE_CODES: ReadonlySet<string> = new Set([
  'contract',
  'contractor',
  'consultant',
  'freelancer',
]);

/**
 * The person type implied by an employment type code. With no employment type
 * selected, `fallback` is kept — 'employee' for a new person, the stored value
 * when editing, so clearing the field never flips an existing record.
 */
export const personTypeForEmploymentType = (
  employmentTypeCode: string | null | undefined,
  fallback: PersonType = 'employee',
): PersonType => {
  if (!employmentTypeCode) return fallback;
  return CONTRACTOR_EMPLOYMENT_TYPE_CODES.has(employmentTypeCode.toLowerCase())
    ? 'contractor'
    : 'employee';
};

export const personTypeLabel = (type: PersonType): string =>
  type === 'contractor' ? 'Contractor' : 'Employee';
