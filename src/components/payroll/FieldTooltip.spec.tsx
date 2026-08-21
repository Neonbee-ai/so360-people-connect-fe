import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import FieldTooltip from './FieldTooltip';

const TEXT = "Universal Account Number used for managing an employee's PF account.";

describe('GIVEN a payroll field tooltip', () => {
  it('WHEN it renders THEN the tooltip body is hidden until interacted with', () => {
    render(<FieldTooltip text={TEXT} />);
    expect(screen.getByLabelText(`Help: ${TEXT}`)).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('WHEN hovered THEN the explanation appears and leaves on mouse-out', () => {
    render(<FieldTooltip text={TEXT} />);
    const trigger = screen.getByLabelText(`Help: ${TEXT}`);
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(TEXT);
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('WHEN focused via keyboard THEN the explanation appears and blurs away', () => {
    render(<FieldTooltip text={TEXT} />);
    const trigger = screen.getByLabelText(`Help: ${TEXT}`);
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('WHEN clicked THEN the tooltip toggles open and closed', () => {
    render(<FieldTooltip text={TEXT} />);
    const trigger = screen.getByLabelText(`Help: ${TEXT}`);
    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
