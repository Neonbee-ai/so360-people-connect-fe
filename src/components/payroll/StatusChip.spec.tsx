import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import StatusChip from './StatusChip';

describe('GIVEN the payroll status chip', () => {
  it('WHEN a known status renders THEN it is humanized and title-cased', () => {
    render(<StatusChip status="pending_approval" />);
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  it('WHEN an unknown status renders THEN it falls back to the neutral style without crashing', () => {
    render(<StatusChip status="some_future_status" />);
    const chip = screen.getByText('Some Future Status');
    expect(chip.className).toContain('bg-slate-500/10');
  });

  it('WHEN an explicit label is given THEN it overrides the derived text', () => {
    render(<StatusChip status="active" label="Default" />);
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });
});
