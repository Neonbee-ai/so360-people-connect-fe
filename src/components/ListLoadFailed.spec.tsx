import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Settings } from 'lucide-react';
import ListLoadFailed, { errorStatus, isForbidden } from './ListLoadFailed';

const forbidden = Object.assign(new Error('Forbidden'), { status: 403 });
const serverError = Object.assign(new Error('API Error: 500'), { status: 500 });

describe('ListLoadFailed', () => {
  it('Given the API refused the role (403) / When rendered / Then shows the no-access state without Retry or crash copy', () => {
    render(<ListLoadFailed error={forbidden} plural="Designations" icon={Settings} onRetry={vi.fn()} />);
    expect(screen.getByText("You don't have access to designations")).toBeTruthy();
    expect(screen.getByText(/Ask an admin/)).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
    expect(document.body.textContent).not.toMatch(/something went wrong/i);
  });

  it('Given a server or network failure / When Retry is clicked / Then the list reloads', () => {
    const onRetry = vi.fn();
    render(<ListLoadFailed error={serverError} plural="Labor Categories" icon={Settings} onRetry={onRetry} />);
    expect(screen.getByText("Couldn't load labor categories")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/something went wrong/i);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('Given an error without a status / When classified / Then it is a load failure, not forbidden', () => {
    expect(errorStatus(new Error('Request timed out'))).toBeUndefined();
    expect(isForbidden(new Error('x'))).toBe(false);
    expect(isForbidden(null)).toBe(false);
    expect(isForbidden(forbidden)).toBe(true);
  });
});
