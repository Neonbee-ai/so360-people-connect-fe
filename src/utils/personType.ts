/**
 * The person `type` implied by an Employment Type, so HR picks one field
 * instead of two that could contradict each other.
 *
 * Keyed on the master's CODE, which is what `people.employment_type` stores.
 *
 * Product decision (PR #34 review):
 *  - contractor-style codes (contract, contractor, consultant, freelancer) ->
 *    `contractor`: a non-employee, excluded from employee headcount, payroll
 *    and leave. `consultant` is only an employment-type DISPLAY label; the
 *    person type derived from it is `contractor`, never `consultant`.
 *  - every other code, including `temporary` and org-created codes ->
 *    `employee` (included in headcount, leave and payroll).
 *
 * The backend still accepts a stored person type of `consultant` (legacy
 * data), so `PersonType` includes it for reading/displaying. It is never
 * derived: see `typeToSendOnEdit` for when a stored value may be rewritten.
 */
export type PersonType = 'employee' | 'contractor' | 'consultant';

export const CONTRACTOR_EMPLOYMENT_TYPE_CODES: ReadonlySet<string> = new Set([
  'contract',
  'contractor',
  'consultant',
  'freelancer',
]);

/**
 * The person type implied by an employment type code. With no employment type
 * selected, `fallback` is kept: 'employee' for a new person, the stored value
 * when editing, so clearing the field never flips an existing record.
 */
export const personTypeForEmploymentType = (
  employmentTypeCode: string | null | undefined,
  fallback: PersonType = 'employee',
): PersonType => {
  if (!employmentTypeCode) return fallback;
  return CONTRACTOR_EMPLOYMENT_TYPE_CODES.has(employmentTypeCode.toLowerCase()) ? 'contractor' : 'employee';
};

const norm = (code: string | null | undefined) => (code ? code.toLowerCase() : '');

/**
 * What an Edit save may put in the payload's `type`: undefined (omit it, the
 * stored value is untouched) unless the user changed the Employment Type to a
 * real value AND that implies a different type than the one stored.
 */
export const typeToSendOnEdit = (
  originalCode: string | null | undefined,
  currentCode: string | null | undefined,
  storedType: PersonType,
): PersonType | undefined => {
  if (norm(originalCode) === norm(currentCode)) return undefined;
  if (!currentCode) return undefined; // cleared: keep the stored type
  const next = personTypeForEmploymentType(currentCode, storedType);
  return next === storedType ? undefined : next;
};

export const personTypeLabel = (type: PersonType): string => {
  if (type === 'contractor') return 'Contractor';
  if (type === 'consultant') return 'Consultant';
  return 'Employee';
};
