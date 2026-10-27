import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

describe('Given the shared-link aliases /people/approvals and /people/approval-chains', () => {
  it('When the route table is read / Then approvals redirects to the leave approvals page', () => {
    expect(src).toMatch(/path="approvals"\s+element=\{<Navigate to="\/people\/leaves\/approvals" replace \/>\}/);
  });
  it('When the route table is read / Then approval-chains redirects to the settings page', () => {
    expect(src).toMatch(/path="approval-chains"\s+element=\{<Navigate to="\/people\/settings\/approval-chains" replace \/>\}/);
  });
});
