// =============================================================================
// requestCache — in-flight request coalescing + bounded short-TTL value cache.
//
// Collapses concurrent calls for the same key into a single network request and
// (optionally) serves a cached value for a short TTL. Used to stop duplicate
// fetches of org-static data (e.g. utilization summary) when several pages or
// effects ask for it at once or in quick succession.
//
// Failures are never cached. Keys should include the org id so a tenant/org
// switch can never serve another org's data. Mutations invalidate by prefix.
// =============================================================================

export interface RequestCache {
  run<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T>;
  invalidate(prefix?: string): void;
  size(): number;
}

export function createRequestCache(opts?: {
  defaultTtlMs?: number;
  maxEntries?: number;
  now?: () => number;
}): RequestCache {
  const defaultTtlMs = opts?.defaultTtlMs ?? 0;
  const maxEntries = opts?.maxEntries ?? 200;
  const now = opts?.now ?? (() => Date.now());
  const values = new Map<string, { value: unknown; expiresAt: number }>();
  const inFlight = new Map<string, Promise<unknown>>();

  function prune(): void {
    const t = now();
    for (const [k, e] of values) {
      if (e.expiresAt <= t) values.delete(k);
    }
    while (values.size > maxEntries) {
      const oldest = values.keys().next().value;
      if (oldest === undefined) break;
      values.delete(oldest);
    }
  }

  return {
    run<T>(key: string, fetcher: () => Promise<T>, ttlMs = defaultTtlMs): Promise<T> {
      if (ttlMs > 0) {
        const hit = values.get(key);
        if (hit && hit.expiresAt > now()) return Promise.resolve(hit.value as T);
        if (hit) values.delete(key);
      }
      const pending = inFlight.get(key);
      if (pending) return pending as Promise<T>;
      const p = fetcher()
        .then((val) => {
          if (ttlMs > 0) {
            values.set(key, { value: val, expiresAt: now() + ttlMs });
            prune();
          }
          return val;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, p);
      return p as Promise<T>;
    },
    invalidate(prefix?: string): void {
      if (!prefix) {
        values.clear();
        return;
      }
      for (const k of [...values.keys()]) {
        if (k.startsWith(prefix)) values.delete(k);
      }
    },
    size(): number {
      return values.size;
    },
  };
}
