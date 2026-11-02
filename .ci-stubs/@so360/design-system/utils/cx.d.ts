/**
 * Dependency-free Tailwind class merge.
 *
 * Tailwind decides which of two conflicting utilities wins by their order in the
 * generated CSS, not by their order in the class attribute. So `h-9 h-auto` is
 * not "h-auto wins" — it is whichever rule the stylesheet emitted last. A DS
 * component that concatenates a caller's `className` after its own base classes
 * therefore cannot promise the caller's override wins.
 *
 * `cx` fixes that: within the same conflict group and the same variant prefix
 * (`hover:`, `sm:`, `aria-pressed:` …), the LAST class wins and the earlier ones
 * are dropped. Anything it does not recognise is kept untouched, `!important`
 * classes are never dropped and never drop others, and classes in different
 * groups (`text-sm` vs `text-primary`, `border` vs `border-line`) are both kept.
 *
 * `mergeClassName(base, override)` is the form DS components use: the base is
 * returned byte-for-byte when there is no override (default looks unchanged), and
 * only base classes that conflict with the override are removed.
 */
export type ClassValue = string | number | false | null | undefined;
/** Conflict group for one utility (no variant prefix, no `!`), or null when unknown (kept as-is). */
export declare function classGroup(utility: string): string | null;
/** Join truthy class values; later Tailwind classes win over earlier ones in the same conflict group. */
export declare function cx(...values: ClassValue[]): string;
/**
 * DS component form: `base` unchanged when there is no override; otherwise base classes that conflict
 * with `override` are dropped and `override` (itself merged) is appended. Base-internal classes are never
 * merged against each other, so a component's own look is exactly what it was.
 */
export declare function mergeClassName(base: string, override?: ClassValue): string;
