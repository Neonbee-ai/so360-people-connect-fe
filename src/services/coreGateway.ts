/**
 * Core gateway resolution for direct (non-axios) fetches to so360-core.
 *
 * On preview hosts (pr-<slug>.skyoffice360.com) the shell injects
 * `window.VITE_SO360_CORE_API` and preview nginx does NOT route bare relative
 * `/v1/...` requests, so direct Core calls must be prefixed with the gateway.
 *
 * Precedence: runtime window value → literal `import.meta.env.VITE_SO360_CORE_API`
 * (Vite only substitutes the literal form; `(import.meta as any).env?.X` is
 * never replaced and evaluates to undefined in a built bundle) → `fallback`.
 */
export function resolveCoreGatewayBase(fallback = ''): string {
  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  const fromWindow =
    win && typeof win.VITE_SO360_CORE_API === 'string' && win.VITE_SO360_CORE_API.trim()
      ? win.VITE_SO360_CORE_API.trim()
      : '';
  const fromEnv =
    typeof import.meta.env.VITE_SO360_CORE_API === 'string'
      ? import.meta.env.VITE_SO360_CORE_API.trim()
      : '';
  const base = fromWindow || fromEnv || fallback;
  return base.replace(/\/+$/, '');
}

/** Prefix a `/v1/...` path with the core gateway; relative when none is set. */
export function coreGatewayUrl(path: string, fallback = ''): string {
  return `${resolveCoreGatewayBase(fallback)}${path}`;
}
