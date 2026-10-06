import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRefreshOnReturn, REFRESH_ON_RETURN_MIN_INTERVAL_MS } from './useRefreshOnReturn';

/**
 * useRefreshOnReturn — BDD specs. Data is re-read once when the user returns
 * from a page opened in a new tab, never on every focus change.
 */
const focus = () => act(() => { window.dispatchEvent(new Event('focus')); });

describe('useRefreshOnReturn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('Given the link was never clicked / When the window gains focus repeatedly / Then nothing is refetched', () => {
    const refresh = vi.fn();
    renderHook(() => useRefreshOnReturn(true, refresh));

    focus();
    focus();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('Given the link was clicked / When the user returns / Then it refetches exactly once', () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useRefreshOnReturn(true, refresh));

    act(() => result.current());
    focus();
    focus();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('Given a refetch just ran / When the link is clicked again and focus returns within the interval / Then it waits, then refetches once the interval has passed', () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useRefreshOnReturn(true, refresh));
    act(() => result.current());
    focus();
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => result.current());
    vi.setSystemTime(Date.now() + REFRESH_ON_RETURN_MIN_INTERVAL_MS - 1);
    focus();
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 2);
    focus();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('Given the link was clicked / When the tab becomes visible again / Then it refetches', () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useRefreshOnReturn(true, refresh));

    act(() => result.current());
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('Given the form is closed / When focus returns / Then nothing is refetched', () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useRefreshOnReturn(false, refresh));

    act(() => result.current());
    focus();

    expect(refresh).not.toHaveBeenCalled();
  });
});
