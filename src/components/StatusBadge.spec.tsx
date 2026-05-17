import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import StatusBadge from './StatusBadge';

describe('Given StatusBadge with person statuses', () => {
  it('When status is active / Then it displays "Active"', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('When status is inactive / Then it displays "Inactive"', () => {
    render(<StatusBadge status="inactive" />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('When status is on_leave / Then it displays "On Leave" (underscores replaced)', () => {
    render(<StatusBadge status="on_leave" />);
    expect(screen.getByText('On Leave')).toBeInTheDocument();
  });

  it('When status is terminated / Then it displays "Terminated"', () => {
    render(<StatusBadge status="terminated" />);
    expect(screen.getByText('Terminated')).toBeInTheDocument();
  });
});

describe('Given StatusBadge with review/leave statuses', () => {
  it('When status is approved / Then it displays "Approved"', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('When status is rejected / Then it displays "Rejected"', () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('When status is draft / Then it displays "Draft"', () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('When status is submitted / Then it displays "Submitted"', () => {
    render(<StatusBadge status="submitted" />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });
});

describe('Given StatusBadge with type badges', () => {
  it('When status is employee / Then it displays "Employee"', () => {
    render(<StatusBadge status="employee" />);
    expect(screen.getByText('Employee')).toBeInTheDocument();
  });

  it('When status is contractor / Then it displays "Contractor"', () => {
    render(<StatusBadge status="contractor" />);
    expect(screen.getByText('Contractor')).toBeInTheDocument();
  });
});

describe('Given StatusBadge with an unknown status', () => {
  it('When an unrecognized status is passed / Then it still renders with formatted label', () => {
    render(<StatusBadge status="pending_review" />);
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });
});
