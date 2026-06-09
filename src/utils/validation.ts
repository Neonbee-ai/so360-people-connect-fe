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
