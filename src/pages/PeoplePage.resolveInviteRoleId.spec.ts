/**
 * resolveInviteRoleId — BDD specs.
 *
 * Both invite actions on PeoplePage used to send `roles.data[0].id`: whichever
 * role the API happened to return first. That made the role granted to a new
 * user arbitrary (Guest in some orgs, Admin in others), and because the backend
 * upserts invites on (org_id, email), pressing "Resend" silently OVERWROTE the
 * role an administrator had deliberately chosen.
 *
 * The helper now keeps the person's own role when they have one, otherwise uses
 * the canonical Employee role, and returns undefined rather than guessing.
 *
 * The service modules are mocked out so importing the page never touches the
 * API layer — only the pure helper is under test.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/peopleService', () => ({ peopleApi: {} }));
vi.mock('../services/workLocationsService', () => ({ workLocationsApi: {} }));
vi.mock('../services/mastersService', () => ({ mastersApi: {} }));
vi.mock('../services/customFieldsService', () => ({
    customFieldDefsApi: {},
    personCustomFieldsApi: {},
    CHOICE_FIELD_TYPES: [],
}));
vi.mock('../services/settingsService', () => ({ fetchOrgBaseCurrency: vi.fn() }));

import { resolveInviteRoleId } from './PeoplePage';
import type { Person } from '../types/people';

const person = (system_role?: string | null): Person =>
    ({ id: 'p-1', full_name: 'Ravi Kumar', system_role }) as unknown as Person;

const ADMIN = { id: 'role-admin', name: 'Admin' };
const GUEST = { id: 'role-guest', name: 'Guest' };
const EMPLOYEE = { id: 'role-employee', name: 'Employee' };

describe('resolveInviteRoleId', () => {
    it("Given the person already has the Admin role / Then the org's Admin role id is returned", () => {
        expect(resolveInviteRoleId(person('Admin'), [GUEST, ADMIN, EMPLOYEE])).toBe('role-admin');
    });

    it('Given the role names differ only by case / Then they still match', () => {
        expect(resolveInviteRoleId(person('ADMIN'), [GUEST, ADMIN, EMPLOYEE])).toBe('role-admin');
        expect(resolveInviteRoleId(person('admin'), [GUEST, ADMIN, EMPLOYEE])).toBe('role-admin');
    });

    it('Given the role names differ only by surrounding whitespace / Then they still match', () => {
        expect(
            resolveInviteRoleId(person('  Admin  '), [GUEST, { id: 'role-admin', name: ' admin' }]),
        ).toBe('role-admin');
    });

    it('Given the person has no system_role / Then the canonical Employee role is used', () => {
        expect(resolveInviteRoleId(person(null), [GUEST, ADMIN, EMPLOYEE])).toBe('role-employee');
        expect(resolveInviteRoleId(person(undefined), [GUEST, ADMIN, EMPLOYEE])).toBe('role-employee');
    });

    it('Given the person carries a role the org does not have / Then it falls back to Employee', () => {
        expect(resolveInviteRoleId(person('Superintendent'), [GUEST, ADMIN, EMPLOYEE])).toBe(
            'role-employee',
        );
    });

    it('Given an unknown role and NO Employee role / Then it returns undefined instead of roles[0]', () => {
        // The regression: Guest is first in the list and must never be handed out
        // as a silent default.
        expect(resolveInviteRoleId(person('Superintendent'), [GUEST, ADMIN])).toBeUndefined();
    });

    it('Given no system_role and NO Employee role / Then it returns undefined instead of roles[0]', () => {
        expect(resolveInviteRoleId(person(null), [GUEST, ADMIN])).toBeUndefined();
    });

    it('Given an empty or missing roles list / Then it returns undefined', () => {
        expect(resolveInviteRoleId(person('Admin'), [])).toBeUndefined();
        expect(resolveInviteRoleId(person('Admin'), undefined)).toBeUndefined();
    });

    it("Given the org's Employee role is not first / Then position never influences the result", () => {
        expect(resolveInviteRoleId(person(null), [GUEST, ADMIN, EMPLOYEE])).not.toBe(GUEST.id);
        expect(resolveInviteRoleId(person(null), [ADMIN, GUEST, EMPLOYEE])).toBe('role-employee');
    });
});
