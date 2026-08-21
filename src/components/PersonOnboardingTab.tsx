import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, CheckCircle, Ban, Play, Upload } from 'lucide-react';
import { toast, getErrorMessage } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import Modal from './Modal';
import EmptyState from './EmptyState';
import {
  onboardingApi,
  type OnboardingInstance,
  type OnboardingInstanceItem,
  type OnboardingInstanceWithItems,
} from '../services/onboardingService';

const ITEM_TYPE_LABELS: Record<string, string> = {
  task: 'Task',
  meeting: 'Meeting',
  document_upload: 'Document',
  e_sign: 'eSignature',
};

const ASSIGNEE_LABELS: Record<string, string> = {
  hr: 'HR',
  manager: 'Manager',
  employee: 'Employee',
};

const ITEM_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  waived: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const ItemStatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
      ITEM_STATUS_STYLES[status] ?? ITEM_STATUS_STYLES.pending
    }`}
  >
    {status}
  </span>
);

/**
 * Person Detail → Onboarding tab.
 *
 * Shows the person's onboarding instance (progress + checklist) with
 * complete/waive actions, or a "Start onboarding" affordance when none exists.
 * Authorization for item actions is enforced server-side (manage holder OR the
 * item's resolved assignee) — the UI only pre-hides what the viewer's
 * permissions could never allow.
 */
const PersonOnboardingTab: React.FC<{ personId: string }> = ({ personId }) => {
  const shell = useShellBridge() as any;
  // Fail open while permissions resolve, fail closed once loaded — the
  // useCanViewCompensation pattern applied to the onboarding codes.
  const canManage = !shell?.permissionsLoaded
    ? true
    : (shell?.hasPermission?.('onboarding.manage') ?? true);

  const [instance, setInstance] = useState<OnboardingInstanceWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [actingItemId, setActingItemId] = useState<string | null>(null);
  const [waiving, setWaiving] = useState<OnboardingInstanceItem | null>(null);
  // B4 — HR attaches the collected document on the hire's behalf.
  const [attaching, setAttaching] = useState<OnboardingInstanceItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await onboardingApi.listInstances({ person_id: personId });
      // Latest non-cancelled instance is the person's onboarding of record.
      const relevant = data
        .filter(i => i.status !== 'cancelled')
        .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''));
      const current: OnboardingInstance | undefined =
        relevant.find(i => i.status === 'in_progress') ?? relevant[0];
      if (!current) {
        setInstance(null);
      } else {
        setInstance(await onboardingApi.getInstance(current.id));
      }
    } catch (err) {
      setInstance(null);
      toast.error(getErrorMessage(err, 'Failed to load onboarding'));
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { void load(); }, [load]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await onboardingApi.startOnboarding({ person_id: personId });
      toast.success('Onboarding started');
      await load();
    } catch (err) {
      // 409 = already has an open instance; 400 = no default template. Both
      // arrive as server messages worth showing verbatim.
      toast.error(getErrorMessage(err, 'Failed to start onboarding'));
    } finally {
      setStarting(false);
    }
  };

  const handleComplete = async (item: OnboardingInstanceItem) => {
    setActingItemId(item.id);
    try {
      const result = await onboardingApi.completeItem(item.id);
      toast.success(result.instance_completed ? 'Onboarding completed 🎉' : `"${item.title}" marked done`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete item'));
    } finally {
      setActingItemId(null);
    }
  };

  const handleWaive = async (item: OnboardingInstanceItem, note: string) => {
    setActingItemId(item.id);
    try {
      const result = await onboardingApi.waiveItem(item.id, note);
      toast.success(result.instance_completed ? 'Onboarding completed' : `"${item.title}" waived`);
      setWaiving(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to waive item'));
    } finally {
      setActingItemId(null);
    }
  };

  const handleAttach = async (item: OnboardingInstanceItem, fileName: string, fileUrl: string) => {
    setActingItemId(item.id);
    try {
      const result = await onboardingApi.uploadItemDocument(item.id, {
        file_name: fileName,
        ...(fileUrl ? { file_url: fileUrl } : {}),
      });
      toast.success(
        result.instance_completed ? 'Onboarding completed 🎉' : `Document attached to "${item.title}"`,
      );
      setAttaching(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to attach document'));
    } finally {
      setActingItemId(null);
    }
  };

  const handleCancel = async () => {
    if (!instance) return;
    try {
      await onboardingApi.cancelInstance(instance.id);
      toast.success('Onboarding cancelled');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel onboarding'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-lg bg-slate-800/50" />
        <div className="h-24 animate-pulse rounded-lg bg-slate-800/50" />
      </div>
    );
  }

  if (!instance) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No onboarding"
        description="Onboarding hasn't been started for this person."
        action={canManage ? { label: starting ? 'Starting…' : 'Start onboarding', onClick: handleStart } : undefined}
      />
    );
  }

  const items = [...instance.items].sort((a, b) => a.sort_order - b.sort_order);
  const settled = items.filter(i => i.status !== 'pending').length;
  const percent = items.length === 0 ? 0 : Math.round((settled / items.length) * 100);

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-teal-400" />
            <span className="text-sm font-medium text-slate-50">
              {instance.status === 'completed' ? 'Onboarding complete' : 'Onboarding in progress'}
            </span>
            <ItemStatusPill status={instance.status === 'completed' ? 'done' : 'pending'} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {settled} of {items.length} steps settled
            </span>
            {canManage && instance.status === 'in_progress' && (
              <button
                onClick={handleCancel}
                className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
              >
                Cancel onboarding
              </button>
            )}
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
          <div
            data-testid="onboarding-progress"
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Started {instance.started_at?.slice(0, 10)}
          {instance.completed_at ? ` · Completed ${instance.completed_at.slice(0, 10)}` : ''}
        </p>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${item.status === 'pending' ? 'text-slate-50' : 'text-slate-400 line-through'}`}>
                    {item.title}
                  </span>
                  <ItemStatusPill status={item.status} />
                  {!item.is_required && <span className="text-[10px] uppercase tracking-wider text-slate-600">Optional</span>}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}
                  {' · '}Assigned to {ASSIGNEE_LABELS[item.assignee_role] ?? item.assignee_role}
                  {item.due_date && ` · Due ${item.due_date}`}
                </div>
                {item.description && <p className="mt-1 text-xs text-slate-400">{item.description}</p>}
                {item.note && <p className="mt-1 text-xs text-slate-500 italic">Note: {item.note}</p>}
              </div>
              {item.status === 'pending' && instance.status === 'in_progress' && (
                <div className="flex shrink-0 items-center gap-2">
                  {item.item_type === 'document_upload' && canManage && (
                    <button
                      onClick={() => setAttaching(item)}
                      disabled={actingItemId === item.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-xs text-white font-medium transition-colors"
                    >
                      <Upload size={12} /> Attach document
                    </button>
                  )}
                  <button
                    onClick={() => handleComplete(item)}
                    disabled={actingItemId === item.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-xs text-white font-medium transition-colors"
                  >
                    <CheckCircle size={12} /> Complete
                  </button>
                  <button
                    onClick={() => setWaiving(item)}
                    disabled={actingItemId === item.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 rounded-lg text-xs text-slate-300 transition-colors"
                  >
                    <Ban size={12} /> Waive
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <EmptyState
            icon={Play}
            title="No checklist items"
            description="This onboarding was started from a template with no items."
          />
        )}
      </div>

      <WaiveModal
        item={waiving}
        onClose={() => setWaiving(null)}
        onWaive={handleWaive}
        busy={!!waiving && actingItemId === waiving.id}
      />

      <AttachDocumentModal
        item={attaching}
        onClose={() => setAttaching(null)}
        onAttach={handleAttach}
        busy={!!attaching && actingItemId === attaching.id}
      />
    </div>
  );
};

// Waive requires a note server-side — the modal exists to collect it.
const WaiveModal: React.FC<{
  item: OnboardingInstanceItem | null;
  onClose: () => void;
  onWaive: (item: OnboardingInstanceItem, note: string) => void;
  busy: boolean;
}> = ({ item, onClose, onWaive, busy }) => {
  const [note, setNote] = useState('');

  useEffect(() => { if (item) setNote(''); }, [item]);

  return (
    <Modal isOpen={!!item} onClose={onClose} title="Waive Onboarding Item" size="sm">
      <form
        onSubmit={e => {
          e.preventDefault();
          if (item && note.trim()) onWaive(item, note.trim());
        }}
        className="space-y-4"
      >
        <p className="text-sm text-slate-400">
          Waive <span className="text-slate-200 font-medium">{item?.title}</span>? A waived required
          step counts as settled. A reason is required.
        </p>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Reason <span className="text-red-400">*</span></label>
          <textarea
            required
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Why this step doesn't apply"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !note.trim()}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg"
          >
            {busy ? 'Waiving…' : 'Waive Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// B4 — collect the document reference (name + optional link). Metadata-first:
// the file itself lives wherever HR stored it (or in the DMS once the
// person-documents upload flow lands); this files the reference into the
// person's cabinet and settles the step.
const AttachDocumentModal: React.FC<{
  item: OnboardingInstanceItem | null;
  onClose: () => void;
  onAttach: (item: OnboardingInstanceItem, fileName: string, fileUrl: string) => void;
  busy: boolean;
}> = ({ item, onClose, onAttach, busy }) => {
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  useEffect(() => {
    if (item) {
      setFileName('');
      setFileUrl('');
    }
  }, [item]);

  return (
    <Modal isOpen={!!item} onClose={onClose} title="Attach Document" size="sm">
      <form
        onSubmit={e => {
          e.preventDefault();
          if (item && fileName.trim()) onAttach(item, fileName.trim(), fileUrl.trim());
        }}
        className="space-y-4"
      >
        <p className="text-sm text-slate-400">
          Attach the collected document for{' '}
          <span className="text-slate-200 font-medium">{item?.title}</span>. It is filed into the
          person's documents and the step is marked done.
        </p>
        <div>
          <label className="block text-xs text-slate-400 mb-1">File name <span className="text-red-400">*</span></label>
          <input
            required
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            placeholder="e.g. passport.pdf"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Link to the file (optional)</label>
          <input
            value={fileUrl}
            onChange={e => setFileUrl(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !fileName.trim()}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg"
          >
            {busy ? 'Attaching…' : 'Attach & Mark Done'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PersonOnboardingTab;
