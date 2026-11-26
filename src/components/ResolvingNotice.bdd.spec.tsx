import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ResolvingNotice } from './ResolvingNotice';

afterEach(() => { vi.useRealTimers(); });

describe('Given shell entitlements are still resolving', () => {
    it('When it has just started / Then a loading status shows, not a blank page', () => {
        render(<ResolvingNotice label="Loading People…" />);
        expect(screen.getByRole('status')).toHaveTextContent('Loading People…');
    });

    it('When the wait exceeds the timeout / Then a bounded error with Retry replaces the spinner', () => {
        vi.useFakeTimers();
        render(<ResolvingNotice timeoutMs={1000} />);
        act(() => { vi.advanceTimersByTime(1001); });
        expect(screen.getByRole('alert')).toHaveTextContent(/taking longer than expected/i);
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
