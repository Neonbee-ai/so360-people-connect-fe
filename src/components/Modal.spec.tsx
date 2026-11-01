import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Modal from './Modal';

// The adapter delegates rendering to the Comb Modal (see src/test/__mocks__/design-system.ts);
// these specs pin the legacy `isOpen` contract that the 25 call sites rely on.
describe('Given the Modal adapter is closed', () => {
  it('When isOpen is false / Then nothing is rendered', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('Given the Modal adapter is open', () => {
  it('When rendered / Then a dialog labelled by the title is shown', () => {
    render(
      <Modal isOpen onClose={() => {}} title="People Details">
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByRole('dialog', { name: 'People Details' })).toBeInTheDocument();
    expect(screen.getByText('People Details')).toBeInTheDocument();
  });

  it('When rendered / Then children are visible', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Test">
        <p>Modal body text</p>
      </Modal>
    );
    expect(screen.getByText('Modal body text')).toBeInTheDocument();
  });

  it('When the close button is clicked / Then onClose is called once', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
