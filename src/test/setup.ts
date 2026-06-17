import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';

// Flush all pending microtasks/promises after each test so that
// async component effects that complete after a test assertion don't
// surface as unhandled rejections in the next test's lifecycle.
afterEach(async () => {
  await new Promise<void>((r) => setTimeout(r, 0));
  cleanup();
});
