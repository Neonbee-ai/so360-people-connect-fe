import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

/**
 * Data Layer on an older Shell: shell-context exposes none of the dataLayer
 * exports (nor useShellBridge), so People Connect pages must render natively.
 */

vi.mock('@so360/shell-context', () => ({}));

import {
    isDataLayerAvailable, usePeopleDataLayer, usePeopleSlot, PeopleSlotRegion, PeopleCreateSection,
    usePeopleInjectedTabs, ensurePeopleRecordLayouts,
} from './peopleDataLayer';

describe('Feature: Data layer on a Shell without the dataLayer API', () => {
    describe('Given shell-context has no dataLayer exports', () => {
        it('then the capability check reports unavailable and layouts are not registered', () => {
            // When / Then
            expect(isDataLayerAvailable()).toBe(false);
            expect(ensurePeopleRecordLayouts()).toBe(false);
        });

        it('then usePeopleDataLayer is disabled with no fields', () => {
            const { result } = renderHook(() => usePeopleDataLayer('people.person'));
            expect(result.current).toEqual({ enabled: false, entity: 'people.person', profile: 'internal', isAdmin: false, fields: [] });
        });

        it('then slots resolve empty even for a state claiming to be enabled', () => {
            const state = { enabled: true, entity: 'people.person' as const, profile: 'internal', isAdmin: false, fields: [] };
            const { result } = renderHook(() => usePeopleSlot(state, 'detail.section'));
            expect(result.current).toEqual([]);
            const tabs = renderHook(() => usePeopleInjectedTabs(state, { recordId: 'person-1', record: null }));
            expect(tabs.result.current).toEqual([]);
            const { container } = render(
                <div>
                    <PeopleSlotRegion dl={state} slot="detail.section" region="main" ctx={{ recordId: 'person-1', record: null }} />
                    <PeopleCreateSection dl={state} mode="create" values={{}} onValuesChange={vi.fn()} />
                </div>,
            );
            expect(container.firstChild?.childNodes.length).toBe(0);
        });
    });
});
