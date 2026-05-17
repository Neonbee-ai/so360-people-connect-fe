import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Modal from './Modal';

describe('Given Modal is closed', () => {
  it('When isOpen is false / Then nothing is rendered', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('Given Modal is open', () => {
  it('When rendered / Then it shows the title', () => {
    render(
      <Modal isOpen onClose={() => {}} title="People Details">
        <p>Content</p>
      </Modal>
    );
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

  it('When the close button is clicked / Then onClose is called', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    // The X button is the first button
    const closeBtn = screen.getAllByRole('button')[0];
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('When the backdrop is clicked / Then onClose is called', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    // backdrop is the fixed overlay div behind the modal panel
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/60') as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('When size is xl / Then the modal panel has max-w-4xl class', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Wide" size="xl">
        <p>Wide content</p>
      </Modal>
    );
    const panel = document.querySelector('.max-w-4xl');
    expect(panel).not.toBeNull();
  });

  it('When size is sm / Then the modal panel has max-w-md class', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Small" size="sm">
        <p>Small content</p>
      </Modal>
    );
    const panel = document.querySelector('.max-w-md');
    expect(panel).not.toBeNull();
  });

  it('When no size is provided / Then the default md size is applied', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Default">
        <p>Content</p>
      </Modal>
    );
    const panel = document.querySelector('.max-w-lg');
    expect(panel).not.toBeNull();
  });
});
