import React from 'react';
import { Check, X, Clock, MinusCircle } from 'lucide-react';
import type { LeaveRequestApproval } from '../../services/leaveRequestsService';

interface ApprovalProgressProps {
  approvals: LeaveRequestApproval[];
  /** Submission time, rendered as the first history entry. */
  submittedAt?: string | null;
  submittedByName?: string | null;
  formatDateTime?: (iso: string) => string;
}

const STATUS_META: Record<
  LeaveRequestApproval['status'],
  { label: string; icon: typeof Check; className: string }
> = {
  approved: { label: 'Approved', icon: Check, className: 'text-teal-400' },
  rejected: { label: 'Rejected', icon: X, className: 'text-rose-400' },
  pending: { label: 'Pending', icon: Clock, className: 'text-amber-400' },
  skipped: { label: 'Not required', icon: MinusCircle, className: 'text-slate-500' },
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
}) => {
  if (!approvals || approvals.length === 0) return null;

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
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Approval Progress
        </h4>
        <span className={`text-xs font-medium ${rejected ? 'text-rose-400' : 'text-slate-400'}`}>
          {rejected ? 'Rejected' : `${approved} of ${total} approved`}
        </span>
      </div>

      <ol className="space-y-2">
        {submittedAt && (
          <li className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 shrink-0 text-slate-500">
              <Check size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-slate-300">
                Submitted{submittedByName ? ` by ${submittedByName}` : ''}
              </span>
              {fmt(submittedAt) && (
                <span className="block text-xs text-slate-500">{fmt(submittedAt)}</span>
              )}
            </span>
          </li>
        )}

        {approvals.map(a => {
          const meta = STATUS_META[a.status] ?? STATUS_META.pending;
          const Icon = meta.icon;
          const name = a.approver?.full_name ?? 'Unknown approver';
          return (
            <li key={a.id} className="flex items-start gap-2.5 text-sm">
              <span className={`mt-0.5 shrink-0 ${meta.className}`}>
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="text-slate-200">{name}</span>
                  <span className={`text-xs ${meta.className}`}>{meta.label}</span>
                </span>
                {a.approver?.job_title && (
                  <span className="block text-xs text-slate-500">{a.approver.job_title}</span>
                )}
                {a.responded_at && fmt(a.responded_at) && (
                  <span className="block text-xs text-slate-500">{fmt(a.responded_at)}</span>
                )}
                {a.decision_notes && (
                  <span className="mt-1 block rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-400">
                    {a.decision_notes}
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
