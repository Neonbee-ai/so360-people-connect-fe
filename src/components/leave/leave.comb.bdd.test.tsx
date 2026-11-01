import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ApprovalProgress from './ApprovalProgress';
import ApproverSelector from './ApproverSelector';
import { LeaveWorkflowStepper } from '../LeaveWorkflowStepper';

const mockEligible = vi.fn();
vi.mock('../../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getEligibleApprovers: (...a: unknown[]) => mockEligible(...a) },
}));

describe('ApprovalProgress (Comb)', () => {
  it('Given no approvals / When rendered / Then nothing is shown', () => {
    const { container } = render(<ApprovalProgress approvals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Given one approved of two / When rendered / Then the counter reads 1 of 2 approved', () => {
    const approvals = [
      { id: 'a', status: 'approved', approver: { full_name: 'Ann' } },
      { id: 'b', status: 'pending', approver: { full_name: 'Bob' } },
    ] as never;
    render(<ApprovalProgress approvals={approvals} />);
    expect(screen.getByText('1 of 2 approved')).toBeInTheDocument();
    expect(screen.getByText('Approval Progress')).toBeInTheDocument();
  });

  it('Given a rejection / When rendered / Then Rejected replaces the counter', () => {
    const approvals = [{ id: 'a', status: 'rejected', approver: { full_name: 'Ann' } }] as never;
    render(<ApprovalProgress approvals={approvals} />);
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
  });
});

describe('LeaveWorkflowStepper (Comb)', () => {
  it('Given cancelled / When rendered / Then Cancelled shows', () => {
    render(<LeaveWorkflowStepper status="cancelled" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});

describe('ApproverSelector (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEligible.mockResolvedValue({
      data: [{ id: 'p1', full_name: 'Ann Lee', job_title: 'Manager', is_suggested: false }],
      suggested_approver_id: null,
    });
  });

  it('Given eligible approvers / When one is clicked / Then onChange gets its id', async () => {
    const onChange = vi.fn();
    render(<ApproverSelector personId="x" value={[]} onChange={onChange} />);
    fireEvent.click(await screen.findByText('Ann Lee'));
    expect(onChange).toHaveBeenCalledWith(['p1']);
  });

  it('Given a selected approver / When Remove is clicked / Then it is deselected', async () => {
    const onChange = vi.fn();
    render(<ApproverSelector personId="x" value={['p1']} onChange={onChange} />);
    await waitFor(() => expect(screen.getByLabelText('Remove Ann Lee')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Remove Ann Lee'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('Given the API fails / When loading / Then an error and Retry show', async () => {
    mockEligible.mockRejectedValue(new Error('x'));
    render(<ApproverSelector personId="x" value={[]} onChange={vi.fn()} />);
    expect(await screen.findByText('Unable to load approvers. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
