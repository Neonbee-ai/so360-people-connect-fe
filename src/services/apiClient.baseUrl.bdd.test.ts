import { describe, it, expect } from 'vitest';
import { resolveApiBaseUrl } from './apiClient';

// The production deploy sets VITE_SO360_PEOPLE_CONNECT_API while the code used to
// read only VITE_SO360_PEOPLE_API — a mismatch masked purely by the Shell
// injecting window.VITE_SO360_PEOPLE_API. Both spellings must now resolve.

describe('Given only the canonical build-time variable is set (what the deploy provides)', () => {
  it('When the base URL is resolved / Then VITE_SO360_PEOPLE_CONNECT_API is used, not the fallback', () => {
    expect(
      resolveApiBaseUrl({ envPeopleConnectApi: 'https://api.neonbee.app/people' })
    ).toBe('https://api.neonbee.app/people');
  });
});

describe('Given only the legacy build-time variable is set', () => {
  it('When the base URL is resolved / Then VITE_SO360_PEOPLE_API is still honoured', () => {
    expect(resolveApiBaseUrl({ envPeopleApi: 'https://legacy.example/people' })).toBe(
      'https://legacy.example/people'
    );
  });
});

describe('Given both build-time variables are set', () => {
  it('When the base URL is resolved / Then the canonical CONNECT name wins over the legacy name', () => {
    expect(
      resolveApiBaseUrl({
        envPeopleConnectApi: 'https://canonical.example/people',
        envPeopleApi: 'https://legacy.example/people',
      })
    ).toBe('https://canonical.example/people');
  });
});

describe('Given the Shell injects a runtime override on window', () => {
  it('When a build-time value also exists / Then the runtime window value wins', () => {
    expect(
      resolveApiBaseUrl({
        windowPeopleApi: 'https://runtime.example/people',
        envPeopleConnectApi: 'https://canonical.example/people',
        envPeopleApi: 'https://legacy.example/people',
      })
    ).toBe('https://runtime.example/people');
  });

  it('When both window names are injected / Then the canonical CONNECT window name wins', () => {
    expect(
      resolveApiBaseUrl({
        windowPeopleConnectApi: 'https://runtime-canonical.example/people',
        windowPeopleApi: 'https://runtime-legacy.example/people',
      })
    ).toBe('https://runtime-canonical.example/people');
  });

  it('When the Shell crutch is removed but the deploy env is present / Then the app still targets the real API', () => {
    // Regression guard: dropping window.VITE_SO360_PEOPLE_API must NOT send every
    // People Connect call to the '/people-api' same-origin fallback.
    expect(
      resolveApiBaseUrl({ envPeopleConnectApi: 'https://api.neonbee.app/people' })
    ).toBe('https://api.neonbee.app/people');
  });
});

describe('Given absent, blank or non-string candidate values', () => {
  it('When nothing is provided / Then it falls back to the same-origin proxy path', () => {
    expect(resolveApiBaseUrl({})).toBe('/people-api');
  });

  it('When values are undefined / Then it falls back to the same-origin proxy path', () => {
    expect(
      resolveApiBaseUrl({
        windowPeopleConnectApi: undefined,
        windowPeopleApi: undefined,
        envPeopleConnectApi: undefined,
        envPeopleApi: undefined,
      })
    ).toBe('/people-api');
  });

  it('When a higher-precedence value is empty or whitespace / Then the next candidate is used', () => {
    expect(
      resolveApiBaseUrl({
        windowPeopleConnectApi: '',
        windowPeopleApi: '   ',
        envPeopleConnectApi: '',
        envPeopleApi: 'https://legacy.example/people',
      })
    ).toBe('https://legacy.example/people');
  });

  it('When a candidate is a non-string (e.g. false from a window guard) / Then it is ignored', () => {
    // `_win && _win.VITE_...` yields `undefined`/`false` when window is absent.
    expect(
      resolveApiBaseUrl({
        windowPeopleConnectApi: false,
        windowPeopleApi: false,
        envPeopleConnectApi: 'https://canonical.example/people',
      })
    ).toBe('https://canonical.example/people');
  });
});
