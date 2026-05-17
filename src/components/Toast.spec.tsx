import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import Toast from './Toast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Given Toast with type success', () => {
  it('When rendered / Then it shows the message', () => {
    render(<Toast message="Saved successfully" type="success" onClose={() => {}} />);
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('When rendered / Then the close button is present', () => {
    render(<Toast message="Done" type="success" onClose={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('When the close button is clicked / Then onClose is called', () => {
    const handleClose = vi.fn();
    render(<Toast message="Done" type="success" onClose={handleClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('Given Toast with auto-dismiss duration', () => {
  it('When default duration elapses / Then onClose is called automatically', () => {
    const handleClose = vi.fn();
    render(<Toast message="Auto dismiss" type="info" onClose={handleClose} />);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('When custom duration is set / Then onClose fires after that duration', () => {
    const handleClose = vi.fn();
    render(<Toast message="Custom" type="error" onClose={handleClose} duration={2000} />);
    act(() => { vi.advanceTimersByTime(1999); });
    expect(handleClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('Given Toast with error type', () => {
  it('When rendered / Then the message is visible', () => {
    render(<Toast message="Something went wrong" type="error" onClose={() => {}} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('Given Toast with info type', () => {
  it('When rendered / Then the message is visible', () => {
    render(<Toast message="Loading data..." type="info" onClose={() => {}} />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });
});
