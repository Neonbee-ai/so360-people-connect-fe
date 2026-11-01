import React from 'react';
import { Check, X, Clock, MinusCircle } from 'lucide-react';
import { Alert } from '@so360/design-system';
import type { LeaveRequestApproval } from '../../services/leaveRequestsService';

interface ApprovalProgressProps {
  approvals: LeaveRequestApproval[];
  /** Submission time, rendered as the first history entry. */
  submittedAt?: string | null;
  submittedByName?: string | null;
  formatDateTime?: (iso: string) => string;
  /**
   * Request-level rejection reason. Shown on the rejecting approver only when
   * that approval row has no notes of its own (requests rejected before
   * per-approver notes were stored), so old rejections still show a reason.
   */
  fallbackRejectionReason?: string | null;
}

const STATUS_META: Record<
  LeaveRequestApproval['status'],
  { label: string; icon: typeof Check; className: string }
> = {
  approved: { label: 'Approved', icon: Check, className: 'text-primary' },
  rejected: { label: 'Rejected', icon: X, className: 'text-danger' },
  pending: { label: 'Pending', icon: Clock, className: 'text-warning' },
  skipped: { label: 'Not required', icon: MinusCircle, className: 'text-fg-subtle' },
};

/**
 * Who a leave request is waiting on, and what has already been decided.
 *
 * Renders nothing when there are no assignments — auto-approved leave types and
 * orgs with no department head produce requests with no approvers, and an empty
 * "Approval Progress" heading there would imply a chain that doesn't exist.
 *
 * The counter deliberately counts APPROVED against TOTAL rather than
 * decided-against-total: a rejection ends the request, so "1 of 2" after a
 * rejection would suggest the remaining approver still owes a decision.
 */
const ApprovalProgress: React.FC<ApprovalProgressProps> = ({
  approvals,
  submittedAt,
  submittedByName,
  formatDateTime,
  fallbackRejectionReason,
}) => {
  if (!approvals || approvals.length === 0) {
    // Old rejections have no approval rows: keep their reason visible.
    if (fallbackRejectionReason) {
      return (
        <Alert name="leave-rejection-reason" variant="error" title="Rejected">
          {fallbackRejectionReason}
        </Alert>
      );
    }
    return null;
  }

  const fmt = (iso?: string | null) => {
    if (!iso) return '';
    try {
      return formatDateTime ? formatDateTime(iso) : new Date(iso).toLocaleString();
    } catch {
      return '';
    }
  };

  const total = approvals.length;
  const approved = approvals.filter(a => a.status === 'approved').length;
  const rejected = approvals.find(a => a.status === 'rejected');

  return (
    <div className="rounded-nb border border-line-strong bg-surface-raised/50 p-nb-3">
      <div className="mb-nb-3 flex items-center justify-between gap-nb-3">
        <h4 className="text-nb-label text-fg-muted">
          Approval Progress
        </h4>
        <span className={`text-nb-caption font-medium ${rejected ? 'text-danger' : 'text-fg-muted'}`}>
          {rejected ? 'Rejected' : `${approved} of ${total} approved`}
        </span>
      </div>

      <ol className="flex flex-col gap-nb-2">
        {submittedAt && (
          <li className="flex items-start gap-nb-2 text-nb-body">
            <span className="mt-nb-1 shrink-0 text-fg-subtle">
              <Check size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-fg">
                Submitted{submittedByName ? ` by ${submittedByName}` : ''}
              </span>
              {fmt(submittedAt) && (
                <span className="block text-nb-caption text-fg-subtle">{fmt(submittedAt)}</span>
              )}
            </span>
          </li>
        )}

        {approvals.map(a => {
          const meta = STATUS_META[a.status] ?? STATUS_META.pending;
          const Icon = meta.icon;
          const name = a.approver?.full_name ?? 'Unknown approver';
          return (
            <li key={a.id} className="flex items-start gap-nb-2 text-nb-body">
              <span className={`mt-nb-1 shrink-0 ${meta.className}`}>
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-nb-2">
                  <span className="text-fg">{name}</span>
                  <span className={`text-nb-caption ${meta.className}`}>{meta.label}</span>
                </span>
                {a.approver?.job_title && (
                  <span className="block text-nb-caption text-fg-subtle">{a.approver.job_title}</span>
                )}
                {a.responded_at && fmt(a.responded_at) && (
                  <span className="block text-nb-caption text-fg-subtle">{fmt(a.responded_at)}</span>
                )}
                {(a.decision_notes || (a.status === 'rejected' && fallbackRejectionReason)) && (
                  <span className="mt-nb-1 block rounded border border-line-strong bg-surface/60 px-nb-2 py-nb-1 text-nb-caption text-fg-muted">
                    {a.decision_notes || fallbackRejectionReason}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default ApprovalProgress;
