import { configure } from '@testing-library/react';

// apiClient resolves its base URL at import time. Without one it falls back to the
// relative '/people-api', which jsdom's fetch cannot parse ("Invalid URL"). Give the
// test runtime an absolute base, as the Shell does in the browser.
(window as any).VITE_SO360_PEOPLE_CONNECT_API ??= 'http://localhost/people-api';
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
afterEach(cleanup);

// Testing Library's waitFor/findBy default to 1s, which a loaded Contabo runner
// blows through: a different handful of specs fails each run and all of them
// pass on an idle box. Raise the budget globally — a passing assertion still
// resolves as soon as its condition holds, so this costs nothing when green.
configure({ asyncUtilTimeout: 5000 });
