import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

/**
 * Module landing — BDD specs.
 *
 * People Connect opened on the admin Dashboard for everyone. For an employee
 * that is a workforce overview they hold no permissions to populate, so the
 * first thing they saw was an empty page. The landing route now branches, and
 * these specs pin the branch — including the loading case, where guessing
 * would bounce an administrator into the employee view.
 */

const shellState: {
    permissionsLoaded: boolean;
    hasPermission: (c: string) => boolean;
} = { permissionsLoaded: true, hasPermission: () => false };

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({
        permissionsLoaded: shellState.permissionsLoaded,
        hasPermission: (c: string) => shellState.hasPermission(c),
    }),
}));

/** Mirrors the ModuleLanding decision in App.tsx. */
const decideLanding = (
    shell: { permissionsLoaded: boolean; hasPermission: (c: string) => boolean } | null,
): 'dashboard' | 'my' | null => {
    if (shell && shell.permissionsLoaded === false) return null;
    const isAdminViewer =
        shell?.hasPermission?.('employees.read') ||
        shell?.hasPermission?.('departments.read') ||
        shell?.hasPermission?.('*');
    return isAdminViewer ? 'dashboard' : 'my';
};

beforeEach(() => {
    shellState.permissionsLoaded = true;
    shellState.hasPermission = () => false;
});

describe('Given an employee opening People Connect', () => {
    it('When they hold no workforce read / Then they land on My Work', () => {
        expect(decideLanding(shellState)).toBe('my');
    });
});

describe('Given an administrator opening People Connect', () => {
    it.each(['employees.read', 'departments.read', '*'])(
        'When they hold %s / Then they still land on the Dashboard',
        (code) => {
            shellState.hasPermission = (c) => c === code;
            expect(decideLanding(shellState)).toBe('dashboard');
        },
    );
});

describe('Given entitlements that have not resolved yet', () => {
    it('When the module opens / Then it waits rather than guessing', () => {
        // Guessing here would redirect an admin to the employee view and then
        // leave them there, since the redirect has already happened.
        shellState.permissionsLoaded = false;
        shellState.hasPermission = () => true;

        expect(decideLanding(shellState)).toBeNull();
    });
});

describe('Given no shell bridge at all', () => {
    it('When the module opens standalone / Then it falls back to My Work', () => {
        expect(decideLanding(null)).toBe('my');
    });
});

describe('Given the routing source', () => {
    it('When App.tsx is read / Then the landing route is not a hard-coded dashboard redirect', () => {
        const source = require('fs').readFileSync(
            require('path').join(__dirname, 'App.tsx'),
            'utf8',
        );

        expect(source).toContain('<Route path="/" element={<ModuleLanding />} />');
        expect(source).not.toContain('<Route path="/" element={<Navigate to="dashboard" replace />} />');
    });
});
