import { describe, it, expect } from 'vitest';

/**
 * Department head assignment — BDD spec.
 *
 * `departments.head_person_id` is the ONLY reporting edge in the schema —
 * there is deliberately no people.manager_id. Every manager-scoped behaviour
 * (leave approver routing, reviewer eligibility, "my team" views) walks it.
 *
 * The create/edit form carried head_person_id in its payload but rendered no
 * input for it, so every department was created headless and the only way to
 * set one was buried in the detail page. The measured result: 32 departments
 * platform-wide, 0 with a head, and every manager-scoped feature silently
 * resolving to nobody. This spec keeps the field on the form.
 */

const source = () =>
    require('fs').readFileSync(
        require('path').join(__dirname, 'DepartmentsPage.tsx'),
        'utf8',
    );

describe('Given the department create/edit form', () => {
    it('When it is rendered / Then a Department Head field is offered', () => {
        expect(source()).toContain('Department Head');
    });

    it('When a head is chosen / Then it is written to head_person_id', () => {
        expect(source()).toMatch(/updateField\('head_person_id'/);
    });

    it('When the form opens / Then people are loaded to choose from', () => {
        expect(source()).toContain('peopleApi');
    });

    it('When no head is chosen / Then it is explicitly optional, not silently blank', () => {
        expect(source()).toContain('Not assigned');
    });

    it('When the field is shown / Then it explains what the head is for', () => {
        // Without the "why", an admin skips it and the reporting graph stays
        // empty — which is exactly how it got to 0 of 32.
        expect(source()).toMatch(/route to its head/i);
    });
});

describe('Given a department with no head assigned', () => {
    it('When the list is rendered / Then it is called out rather than shown as normal', () => {
        // Silent absence is how the platform reached 32 departments with 0
        // heads and every manager-scoped feature resolving to nobody.
        expect(source()).toContain('No head assigned');
    });

    it('When it is called out / Then it says what breaks, not just that it is missing', () => {
        expect(source()).toMatch(/nobody to route to/i);
    });

    it('When the department is inactive / Then it is not nagged about', () => {
        expect(source()).toMatch(/!dept\.head_person_id && dept\.is_active/);
    });
});
