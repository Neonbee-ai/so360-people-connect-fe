import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LeaveWorkflowStepper } from './LeaveWorkflowStepper';

describe('Given LeaveWorkflowStepper with forward flow statuses', () => {
  it('When status is draft / Then "Draft" step is displayed', () => {
    render(<LeaveWorkflowStepper status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('When status is draft / Then all three forward steps are visible', () => {
    render(<LeaveWorkflowStepper status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('When status is submitted / Then "Submitted" label is displayed', () => {
    render(<LeaveWorkflowStepper status="submitted" />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('When status is pending / Then it maps to "Submitted" label', () => {
    render(<LeaveWorkflowStepper status="pending" />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('When status is approved / Then "Approved" label is displayed', () => {
    render(<LeaveWorkflowStepper status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
});

describe('Given LeaveWorkflowStepper with rejection status', () => {
  it('When status is rejected / Then "Rejected" label is displayed', () => {
    render(<LeaveWorkflowStepper status="rejected" />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('When status is rejected / Then "Draft" and "Submitted" steps are still shown', () => {
    render(<LeaveWorkflowStepper status="rejected" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });
});

describe('Given LeaveWorkflowStepper with cancelled status', () => {
  it('When status is cancelled / Then "Cancelled" is displayed', () => {
    render(<LeaveWorkflowStepper status="cancelled" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('When status is cancelled / Then forward step labels are NOT shown', () => {
    render(<LeaveWorkflowStepper status="cancelled" />);
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    expect(screen.queryByText('Submitted')).not.toBeInTheDocument();
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  });
});

describe('Given LeaveWorkflowStepper with case-insensitive status', () => {
  it('When status is APPROVED (uppercase) / Then it normalizes and shows approved flow', () => {
    render(<LeaveWorkflowStepper status="APPROVED" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
});
