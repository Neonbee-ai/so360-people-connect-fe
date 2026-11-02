import React from 'react';
import { render, screen } from '@testing-library/react';
import ApprovalProgress from './ApprovalProgress';

const row = (over: any) => ({
  id: 'a1', approver_id: 'p1', status: 'rejected', responded_at: null,
  decision_notes: null, approver: { full_name: 'Henry' }, ...over,
});

describe('Given a rejected leave request', () => {
  it('When each approver left their own reason / Then each reason shows against its approver', () => {
    render(<ApprovalProgress approvals={[row({ decision_notes: 'Peak season' }), row({ id: 'a2', status: 'approved', decision_notes: 'OK' })] as any} />);
    expect(screen.getByText('Peak season')).toBeTruthy();
    expect(screen.getByText('OK')).toBeTruthy();
  });
  it('When an old rejection only has the request-level reason / Then it is shown on the rejecting approver', () => {
    render(<ApprovalProgress approvals={[row({})] as any} fallbackRejectionReason="Team short-staffed" />);
    expect(screen.getByText('Team short-staffed')).toBeTruthy();
  });
  it('When there are no approval rows but a legacy reason / Then the reason is still shown', () => {
    render(<ApprovalProgress approvals={[]} fallbackRejectionReason="Legacy reason" />);
    expect(screen.getByText('Legacy reason')).toBeTruthy();
  });
  it('When there is nothing to show / Then renders nothing', () => {
    const { container } = render(<ApprovalProgress approvals={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
