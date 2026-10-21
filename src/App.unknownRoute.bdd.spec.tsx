import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Retired / unknown routes — BDD specs.
 *
 * /settings/notification-sender was removed from People Connect (0438d01) but
 * the router had no catch-all, so opening the old URL rendered an empty main.
 * App.tsx is too heavy to mount, so the route table is pinned from its source
 * and the redirect behaviour is exercised on an identical mini-router.
 */
const src = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

describe('Given the People Connect route table', () => {
    it('When the retired notification-sender URL is opened / Then it redirects to the Settings hub', () => {
        expect(src).toMatch(
            /<Route path="settings\/notification-sender" element=\{<Navigate to="\/settings" replace \/>\} \/>/,
        );
    });
    it('When any other path is unmatched / Then a catch-all redirects to the module landing', () => {
        expect(src).toMatch(/<Route path="\*" element=\{<Navigate to="\/" replace \/>\} \/>/);
    });
});

describe('Given a router shaped like the module', () => {
    const renderAt = (path: string) =>
        render(
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/" element={<div>landing</div>} />
                    <Route path="settings" element={<div>hub</div>} />
                    <Route path="settings/notification-sender" element={<Navigate to="/settings" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </MemoryRouter>,
        );
    it('When the retired URL is opened / Then the hub renders', () => {
        renderAt('/settings/notification-sender');
        expect(screen.getByText('hub')).toBeTruthy();
    });
    it('When a nonsense URL is opened / Then the landing renders', () => {
        renderAt('/nope/never');
        expect(screen.getByText('landing')).toBeTruthy();
    });
});
