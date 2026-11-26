import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { Elapsed } from './MyTimePage';

// Elapsed owns the 30 s clock so the page never re-renders for it.

describe('Given the Elapsed clock leaf', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-26T10:00:00Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('When mounted 90 minutes after the start / Then it shows hours and minutes', () => {
        render(<p>Started <Elapsed fromIso="2026-11-26T08:30:00Z" /> ago</p>);
        expect(screen.getByText(/Started 1h 30m ago/)).toBeInTheDocument();
    });

    it('When 30 s ticks pass / Then the text advances without any parent re-render', () => {
        let parentRenders = 0;
        const Parent = () => {
            parentRenders += 1;
            return <p>Started <Elapsed fromIso="2026-11-26T09:59:00Z" /> ago</p>;
        };
        render(<Parent />);
        expect(screen.getByText(/Started 1m ago/)).toBeInTheDocument();
        act(() => { vi.advanceTimersByTime(60_000); });
        expect(screen.getByText(/Started 2m ago/)).toBeInTheDocument();
        expect(parentRenders).toBe(1);
    });

    it('When the start is in the future / Then it clamps to 0m', () => {
        render(<p><Elapsed fromIso="2026-11-26T11:00:00Z" /></p>);
        expect(screen.getByText('0m')).toBeInTheDocument();
    });

    it('When unmounted / Then the interval is cleared', () => {
        const { unmount } = render(<Elapsed fromIso="2026-11-26T09:00:00Z" />);
        const before = vi.getTimerCount();
        unmount();
        expect(vi.getTimerCount()).toBeLessThan(before);
    });
});
