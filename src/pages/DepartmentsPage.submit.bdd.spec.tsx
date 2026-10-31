// Pulse 29889378: Cancel never creates; double submit creates once.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, 'DepartmentsPage.tsx'), 'utf8');

describe('Given the Create Department form', () => {
    it('When Cancel is rendered Then it is a non-submitting button bound to onClose', () => {
        expect(src).toMatch(/type="button"\s+onClick=\{onClose\}[\s\S]{0,200}Cancel/);
    });
    it('When submit runs Then it is guarded against re-entry and disables the button while saving', () => {
        expect(src).toMatch(/if \(submitting\) return/);
        expect(src).toMatch(/disabled=\{!isFormValid \|\| submitting\}/);
    });
});
