// =============================================================================
// Shared client-side validation helpers
// =============================================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns true when `value` is a syntactically valid RFC-4122 UUID.
 *
 * The People Connect backend validates `entity_id` (and other reference ids)
 * with class-validator's `@IsUUID()`. Sending a display id such as "proj-001"
 * triggers a 400 ("entity_id must be a UUID"). Use this to block submission
 * client-side and give the user an actionable message instead.
 */
export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

// =============================================================================
// Master-data field validators
//
// Each `validateX` returns `null` when the value is acceptable, or a
// user-facing message when it is not. They mirror the backend class-validator
// rules exactly so the UI never blocks something the API would accept (and
// never lets through something the API would reject with a raw 400).
// =============================================================================

// At least one letter (any script) — blocks "897+46+4+61" / "5464687987&(&%".
const HAS_LETTER_RE = /\p{L}/u;
// Letters, spaces and the punctuation that occurs in real names.
const PERSON_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;
// Practical RFC-5322 subset: no spaces, single @, dotted TLD of 2+ letters.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
// Digits with an optional leading +, plus the usual separators.
const PHONE_RE = /^\+?[0-9\s().-]+$/;
// Business code: alphanumeric, optionally separated by - or _.
const DEPARTMENT_CODE_RE = /^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/;
// Department names allow the ampersand/slash/parenthesis forms businesses use
// ("R&D", "QA Department", "Sales (EMEA)").
const DEPARTMENT_NAME_RE = /^[\p{L}\p{M}\p{N}\s&/(),.'’-]+$/u;

/** Full name: 2–100 chars, must contain a letter, no digits or symbols. */
export function validatePersonName(value: unknown): string | null {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) return 'Full name is required.';
  if (name.length < 2) return 'Full name must be at least 2 characters.';
  if (name.length > 100) return 'Full name must be 100 characters or fewer.';
  if (!HAS_LETTER_RE.test(name)) return 'Please enter a valid full name.';
  if (!PERSON_NAME_RE.test(name)) {
    return 'Full name can only contain letters, spaces, hyphens, apostrophes and periods.';
  }
  return null;
}

/** Email: standard format. Empty is allowed — pass `required` to forbid it. */
export function validateEmail(value: unknown, required = false): string | null {
  const email = typeof value === 'string' ? value.trim() : '';
  if (!email) return required ? 'Email is required.' : null;
  if (email.length > 254) return 'Email must be 254 characters or fewer.';
  if (!EMAIL_RE.test(email)) return 'Please enter a valid email address.';
  return null;
}

/** Phone: digits (7–15) with an optional leading +. Empty is allowed. */
export function validatePhone(value: unknown, required = false): string | null {
  const phone = typeof value === 'string' ? value.trim() : '';
  if (!phone) return required ? 'Phone number is required.' : null;
  if (!PHONE_RE.test(phone)) {
    return 'Phone number can only contain digits, spaces, +, -, ( ) and .';
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return 'Phone number must contain between 7 and 15 digits.';
  }
  return null;
}

/** Department code: 2–20 alphanumeric chars, optional - / _ separators. */
export function validateDepartmentCode(value: unknown): string | null {
  const code = typeof value === 'string' ? value.trim() : '';
  if (!code) return 'Department code is required.';
  if (code.length < 2) return 'Department code must be at least 2 characters.';
  if (code.length > 20) return 'Department code must be 20 characters or fewer.';
  if (!DEPARTMENT_CODE_RE.test(code)) {
    return 'Please enter a valid department code — letters and numbers only (e.g. ENG, HR-01).';
  }
  return null;
}

/** Department name: 2–100 chars, must contain a letter. */
export function validateDepartmentName(value: unknown): string | null {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) return 'Department name is required.';
  if (name.length < 2) return 'Department name must be at least 2 characters.';
  if (name.length > 100) return 'Department name must be 100 characters or fewer.';
  if (!HAS_LETTER_RE.test(name)) return 'Please enter a valid department name.';
  if (!DEPARTMENT_NAME_RE.test(name)) {
    return 'Department name contains unsupported characters.';
  }
  return null;
}

/** Today as YYYY-MM-DD in the browser's local timezone (not UTC). */
export function todayIso(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().split('T')[0];
}

/**
 * Focus (and scroll to) the first invalid control inside `form`.
 *
 * Used instead of browser-native validation bubbles: those anchor to the field
 * even when it is scrolled out of view, so a user at the bottom of a long modal
 * sees nothing happen when they submit.
 */
export function focusFirstInvalid(
  form: HTMLFormElement | null,
  fieldOrder: string[],
  errors: Record<string, string | null | undefined>,
): void {
  if (!form) return;
  const firstInvalid = fieldOrder.find(field => errors[field]);
  if (!firstInvalid) return;
  const el = form.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`);
  if (!el) return;
  // scrollIntoView is not implemented in every environment (jsdom, older
  // embedded webviews) — focusing is the part that must not be skipped.
  el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  el.focus({ preventScroll: true });
}
