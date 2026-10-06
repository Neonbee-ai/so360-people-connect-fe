/**
 * The person `type` implied by an Employment Type, so HR picks one field
 * instead of two that could contradict each other.
 *
 * Keyed on the master's CODE, which is what `people.employment_type` stores.
 *
 * The backend accepts three stored types: employee | contractor | consultant
 * (people.dto.ts). Only `contractor` maps to the `party:contractor` role when
 * the document workspace is set up; employee AND consultant get
 * `party:employee` (people.service.ts). So rewriting a stored type is not
 * cosmetic and must only happen when the user changed the Employment Type
 * (see `typeToSendOnEdit`).
 *
 * OPEN QUESTION (for the reviewer): should the seeded `consultant` code create
 * a `consultant` person instead of a `contractor`? It currently derives
 * `contractor` for new people (unchanged from before this PR). The mapping is
 * ambiguous because the two differ in their party role, so an EXISTING
 * consultant is never silently converted: see `personTypeForEmploymentType`.
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
 * selected, `fallback` is kept — 'employee' for a new person, the stored value
 * when editing, so clearing the field never flips an existing record.
 *
 * A stored `consultant` stays `consultant` while the new employment type is
 * itself contractor-style (consultant is a kind of contractor engagement), so
 * it is not converted to `contractor`. Moving to a non-contractor employment
 * type (e.g. Full Time) is an explicit change and yields `employee`.
 *
 * `temporary` (seeded in the BE master) is NOT in the contractor set, so it is
 * recorded as an employee. Open question for the reviewer: the BE gives no
 * semantics for it (it is just a seeded code); left as-is to preserve the
 * pre-PR behaviour, and an org can rename/replace the code.
 */
export const personTypeForEmploymentType = (
  employmentTypeCode: string | null | undefined,
  fallback: PersonType = 'employee',
): PersonType => {
  if (!employmentTypeCode) return fallback;
  if (!CONTRACTOR_EMPLOYMENT_TYPE_CODES.has(employmentTypeCode.toLowerCase())) return 'employee';
  return fallback === 'consultant' ? 'consultant' : 'contractor';
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
