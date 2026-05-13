import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================
// EmptyState
// ============================================================

import EmptyState from '../components/EmptyState';

const FakeIcon = (props: any) => <svg data-testid="empty-icon" {...props} />;

describe('EmptyState', () => {
  describe('Given title and description', () => {
    it('When rendered / Then shows title', () => {
      render(<EmptyState icon={FakeIcon} title="No records" description="Add one to get started." />);
      expect(screen.getByText('No records')).toBeInTheDocument();
    });

    it('When rendered / Then shows description', () => {
      render(<EmptyState icon={FakeIcon} title="No records" description="Add one to get started." />);
      expect(screen.getByText('Add one to get started.')).toBeInTheDocument();
    });

    it('When rendered / Then renders the icon', () => {
      render(<EmptyState icon={FakeIcon} title="No records" description="Desc" />);
      expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
    });
  });

  describe('Given action prop', () => {
    it('When action provided / Then shows action button', () => {
      const onClick = vi.fn();
      render(
        <EmptyState icon={FakeIcon} title="Empty" description="Desc" action={{ label: 'Add Item', onClick }} />
      );
      expect(screen.getByText('Add Item')).toBeInTheDocument();
    });

    it('When action button clicked / Then calls onClick', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(
        <EmptyState icon={FakeIcon} title="Empty" description="Desc" action={{ label: 'Add Item', onClick }} />
      );
      await user.click(screen.getByText('Add Item'));
      expect(onClick).toHaveBeenCalledOnce();
    });
  });

  describe('Given no action prop', () => {
    it('When rendered / Then no button is shown', () => {
      render(<EmptyState icon={FakeIcon} title="Empty" description="Nothing here" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});

// ============================================================
// Modal
// ============================================================

import Modal from '../components/Modal';

describe('Modal', () => {
  describe('Given isOpen is false', () => {
    it('When rendered / Then renders nothing', () => {
      const { container } = render(
        <Modal isOpen={false} onClose={vi.fn()} title="My Modal">
          <span>child</span>
        </Modal>
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('Given isOpen is true', () => {
    it('When rendered / Then shows title', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Confirm Action">
          <span>Content here</span>
        </Modal>
      );
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('When rendered / Then renders children', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <span>Inner content</span>
        </Modal>
      );
      expect(screen.getByText('Inner content')).toBeInTheDocument();
    });

    it('When close button clicked / Then calls onClose', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <span>content</span>
        </Modal>
      );
      await user.click(screen.getByRole('button'));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('When backdrop clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={onClose} title="Backdrop Test">
          <span>content</span>
        </Modal>
      );
      // The backdrop is a fixed inset div with bg-black/60 — find all fixed divs and click the backdrop one
      const fixedDivs = container.querySelectorAll('div.fixed');
      const backdrop = Array.from(fixedDivs).find(el => el.classList.contains('bg-black/60') || el.classList.contains('backdrop-blur-sm'));
      if (backdrop) fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Given size prop', () => {
    it('When size is sm / Then panel has max-w-md class', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Small" size="sm">
          <span>content</span>
        </Modal>
      );
      // Find the panel div that holds the title and check its class includes max-w-md
      const panel = Array.from(container.querySelectorAll('div.relative')).find(el =>
        el.className.includes('max-w-md')
      );
      expect(panel).toBeTruthy();
    });

    it('When size is xl / Then panel has max-w-4xl class', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="XL" size="xl">
          <span>content</span>
        </Modal>
      );
      const panel = Array.from(container.querySelectorAll('div.relative')).find(el =>
        el.className.includes('max-w-4xl')
      );
      expect(panel).toBeTruthy();
    });
  });
});

// ============================================================
// PageHeader
// ============================================================

import PageHeader from '../components/PageHeader';

describe('PageHeader', () => {
  describe('Given only title', () => {
    it('When rendered / Then shows title', () => {
      render(<PageHeader title="People Connect" />);
      expect(screen.getByText('People Connect')).toBeInTheDocument();
    });

    it('When no subtitle / Then subtitle is not rendered', () => {
      const { container } = render(<PageHeader title="Title Only" />);
      expect(container.querySelector('p')).not.toBeInTheDocument();
    });
  });

  describe('Given title and subtitle', () => {
    it('When rendered / Then shows subtitle', () => {
      render(<PageHeader title="Utilization" subtitle="Planned vs Actual" />);
      expect(screen.getByText('Planned vs Actual')).toBeInTheDocument();
    });
  });

  describe('Given actions slot', () => {
    it('When actions provided / Then renders actions', () => {
      render(
        <PageHeader
          title="Time Entries"
          actions={<button>Log Time</button>}
        />
      );
      expect(screen.getByText('Log Time')).toBeInTheDocument();
    });
  });

  describe('Given no actions', () => {
    it('When rendered / Then no extra action container', () => {
      const { container } = render(<PageHeader title="Dashboard" />);
      // Actions div is conditional — should not appear
      const actionDivs = container.querySelectorAll('.flex.items-center.gap-3');
      expect(actionDivs.length).toBe(0);
    });
  });
});

// ============================================================
// StatusBadge
// ============================================================

import StatusBadge from '../components/StatusBadge';

describe('StatusBadge', () => {
  describe('Given known status: active', () => {
    it('When rendered / Then shows "Active"', () => {
      render(<StatusBadge status="active" />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('When rendered / Then applies emerald styling', () => {
      render(<StatusBadge status="active" />);
      expect(screen.getByText('Active').className).toContain('emerald');
    });
  });

  describe('Given status with underscore: on_leave', () => {
    it('When rendered / Then replaces underscores with spaces', () => {
      render(<StatusBadge status="on_leave" />);
      expect(screen.getByText('On Leave')).toBeInTheDocument();
    });
  });

  describe('Given status: rejected', () => {
    it('When rendered / Then applies rose styling', () => {
      render(<StatusBadge status="rejected" />);
      expect(screen.getByText('Rejected').className).toContain('rose');
    });
  });

  describe('Given status: submitted', () => {
    it('When rendered / Then applies blue styling', () => {
      render(<StatusBadge status="submitted" />);
      expect(screen.getByText('Submitted').className).toContain('blue');
    });
  });

  describe('Given unknown status', () => {
    it('When rendered / Then shows capitalized label with slate fallback', () => {
      render(<StatusBadge status="pending_review" />);
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });
  });
});

// ============================================================
// Toast
// ============================================================

import Toast from '../components/Toast';

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('Given success type', () => {
    it('When rendered / Then shows message', () => {
      render(<Toast message="Saved successfully" type="success" onClose={vi.fn()} />);
      expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    });

    it('When rendered / Then applies emerald styling', () => {
      const { container } = render(<Toast message="OK" type="success" onClose={vi.fn()} />);
      const toastDiv = container.firstChild as HTMLElement;
      expect(toastDiv?.className).toContain('emerald');
    });
  });

  describe('Given error type', () => {
    it('When rendered / Then applies rose styling', () => {
      const { container } = render(<Toast message="Something went wrong" type="error" onClose={vi.fn()} />);
      const toastDiv = container.firstChild as HTMLElement;
      expect(toastDiv?.className).toContain('rose');
    });
  });

  describe('Given info type', () => {
    it('When rendered / Then applies blue styling', () => {
      const { container } = render(<Toast message="FYI" type="info" onClose={vi.fn()} />);
      const toastDiv = container.firstChild as HTMLElement;
      expect(toastDiv?.className).toContain('blue');
    });
  });

  describe('Given close button', () => {
    it('When close clicked / Then calls onClose immediately', () => {
      const onClose = vi.fn();
      render(<Toast message="msg" type="success" onClose={onClose} />);
      // fireEvent avoids userEvent/fake-timer incompatibilities
      fireEvent.click(screen.getByRole('button'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Given default duration', () => {
    it('When 4000ms elapses / Then auto-calls onClose', () => {
      const onClose = vi.fn();
      render(<Toast message="Timed" type="info" onClose={onClose} />);
      act(() => { vi.advanceTimersByTime(4000); });
      expect(onClose).toHaveBeenCalled();
    });

    it('When custom duration=1000 / Then calls onClose after 1s', () => {
      const onClose = vi.fn();
      render(<Toast message="Quick" type="success" onClose={onClose} duration={1000} />);
      act(() => { vi.advanceTimersByTime(999); });
      expect(onClose).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1); });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
