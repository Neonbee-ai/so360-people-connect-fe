import { describe, it, expect } from 'vitest';

/**
 * GoalsPage person_id — BDD spec.
 *
 * A goal belongs to a PERSON. The modal used to default person_id to
 * apiContext.getUserId() — the auth USER uuid, a different identifier — so
 * every goal an employee created was written against a person that matches no
 * employee record. This asserts the source no longer does that.
 */

const source = () =>
    require('fs').readFileSync(
        require('path').join(__dirname, 'GoalsPage.tsx'),
        'utf8',
    );

describe('Given the goal creation modal', () => {
    it('When the source is read / Then person_id is never seeded from the auth user id', () => {
        expect(source()).not.toContain('apiContext.getUserId()');
    });

    it('When the source is read / Then the person is resolved from the employee record', () => {
        expect(source()).toContain('peopleApi');
        expect(source()).toMatch(/getMe\(\)/);
    });

    it('When the source is read / Then submitting without a resolved person is refused', () => {
        // Writing a goal nobody owns is worse than refusing: it is invisible to
        // the employee and to every report.
        expect(source()).toMatch(/if \(!formData\.person_id\)/);
    });
});
