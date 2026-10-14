import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, CheckCircle, Ban, Play, Upload } from 'lucide-react';
import { toast, getErrorMessage, Select } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import Modal from './Modal';
import EmptyState from './EmptyState';
import {
  onboardingApi,
  type OnboardingInstance,
  type OnboardingInstanceItem,
  type OnboardingInstanceWithItems,
  type OnboardingTemplate,
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
  pending: 'bg-warning/10 text-warning border-warning/20',
  done: 'bg-success/10 text-success border-success/20',
  waived: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/20',
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

  // Templates are fetched alongside the instance so the "no onboarding" state
  // can tell the three cases apart: no templates configured at all, templates
  // but no default, and ready-to-start. Previously all three produced the same
  // button and the difference only surfaced as a server error after clicking.
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [templatesFailed, setTemplatesFailed] = useState(false);
  const [chosenTemplateId, setChosenTemplateId] = useState<string>('');

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

  // Only HR can start onboarding, so only HR needs the template list.
  const loadTemplates = useCallback(async () => {
    if (!canManage) return;
    try {
      const { data } = await onboardingApi.listTemplates();
      const active = data.filter(t => t.is_active);
      setTemplates(active);
      setTemplatesFailed(false);
      // Preselect the org default so the common path is one click; falls back
      // to the only active template when exactly one exists.
      const preferred = active.find(t => t.is_default) ?? (active.length === 1 ? active[0] : undefined);
      setChosenTemplateId(preferred?.id ?? '');
    } catch {
      // Non-fatal: the start button still works and the server will explain if
      // it can't resolve a template. Surfaced as a retry affordance, not a toast
      // — this runs on tab open, and an unprompted error toast reads as a crash.
      setTemplatesFailed(true);
    }
  }, [canManage]);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await onboardingApi.startOnboarding({
        person_id: personId,
        ...(chosenTemplateId ? { template_id: chosenTemplateId } : {}),
      });
      toast.success('Onboarding started');
      await load();
    } catch (err) {
      // 409 = already has an open instance; 404 = no template resolvable. Both
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
        <div className="h-10 animate-pulse rounded-nb bg-surface-raised/50" />
        <div className="h-24 animate-pulse rounded-nb bg-surface-raised/50" />
      </div>
    );
  }

  if (!instance) {
    // No templates configured anywhere in the org — starting is impossible, so
    // point at the fix instead of offering a button that can only fail.
    if (canManage && !templatesFailed && templates.length === 0) {
      return (
        <EmptyState
          icon={ClipboardCheck}
          title="No onboarding templates configured"
          description="Onboarding runs from a checklist template, and this organization doesn't have one yet. Add a standard template — or build your own — then come back to start onboarding."
          action={{
            label: 'Configure Templates',
            onClick: () => { window.location.hash = '#/settings/onboarding'; },
          }}
        />
      );
    }

    return (
      <div className="space-y-4">
        <EmptyState
          icon={ClipboardCheck}
          title="No onboarding"
          description="Onboarding hasn't been started for this person."
        />

        {canManage && (
          <div className="mx-auto w-full max-w-sm space-y-3">
            {templates.length > 0 && (
              <div>
                <label
                  htmlFor="onboarding-template"
                  className="mb-1.5 block text-xs font-medium text-fg-muted"
                >
                  Onboarding template
                </label>
                <Select name="onboarding-template" id="onboarding-template" value={chosenTemplateId} onChange={e => setChosenTemplateId(e.target.value)} options={[{ value: "", label: "Use the organization default" }, ...templates.map((t) => ({ value: t.id, label: `${t.name}${t.is_default ? ' (default)' : ''}` }))]} />
                {!chosenTemplateId && !templates.some(t => t.is_default) && (
                  <p className="mt-1.5 text-xs text-warning">
                    No default template is set — pick one above, or set a default in Settings →
                    Onboarding.
                  </p>
                )}
              </div>
            )}

            {templatesFailed && (
              <p className="text-xs text-fg-subtle">
                Couldn't load the template list.{' '}
                <button
                  onClick={() => void loadTemplates()}
                  className="font-medium text-primary hover:text-primary"
                >
                  Retry
                </button>
                {' '}— starting will still use the organization default.
              </p>
            )}

            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full rounded-nb bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'Start onboarding'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const items = [...instance.items].sort((a, b) => a.sort_order - b.sort_order);
  const settled = items.filter(i => i.status !== 'pending').length;
  const percent = items.length === 0 ? 0 : Math.round((settled / items.length) * 100);

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="bg-surface-raised border border-line-strong rounded-nb p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-primary" />
            <span className="text-sm font-medium text-fg">
              {instance.status === 'completed' ? 'Onboarding complete' : 'Onboarding in progress'}
            </span>
            <ItemStatusPill status={instance.status === 'completed' ? 'done' : 'pending'} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-fg-muted">
              {settled} of {items.length} steps settled
            </span>
            {canManage && instance.status === 'in_progress' && (
              <button
                onClick={handleCancel}
                className="text-xs text-fg-subtle hover:text-danger transition-colors"
              >
                Cancel onboarding
              </button>
            )}
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
          <div
            data-testid="onboarding-progress"
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-fg-subtle">
          Started {instance.started_at?.slice(0, 10)}
          {instance.completed_at ? ` · Completed ${instance.completed_at.slice(0, 10)}` : ''}
        </p>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-surface-raised border border-line-strong rounded-nb p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${item.status === 'pending' ? 'text-fg' : 'text-fg-muted line-through'}`}>
                    {item.title}
                  </span>
                  <ItemStatusPill status={item.status} />
                  {!item.is_required && <span className="text-[10px] uppercase tracking-wider text-fg-subtle">Optional</span>}
                </div>
                <div className="mt-1 text-xs text-fg-subtle">
                  {ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}
                  {' · '}Assigned to {ASSIGNEE_LABELS[item.assignee_role] ?? item.assignee_role}
                  {item.due_date && ` · Due ${item.due_date}`}
                </div>
                {item.description && <p className="mt-1 text-xs text-fg-muted">{item.description}</p>}
                {item.note && <p className="mt-1 text-xs text-fg-subtle italic">Note: {item.note}</p>}
              </div>
              {item.status === 'pending' && instance.status === 'in_progress' && (
                <div className="flex shrink-0 items-center gap-2">
                  {item.item_type === 'document_upload' && canManage && (
                    <button
                      onClick={() => setAttaching(item)}
                      disabled={actingItemId === item.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-nb text-xs text-primary-fg font-medium transition-colors"
                    >
                      <Upload size={12} /> Attach document
                    </button>
                  )}
                  <button
                    onClick={() => handleComplete(item)}
                    disabled={actingItemId === item.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-nb text-xs text-primary-fg font-medium transition-colors"
                  >
                    <CheckCircle size={12} /> Complete
                  </button>
                  <button
                    onClick={() => setWaiving(item)}
                    disabled={actingItemId === item.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-line hover:bg-line-strong border border-line-strong disabled:opacity-50 rounded-nb text-xs text-fg transition-colors"
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
        <p className="text-sm text-fg-muted">
          Waive <span className="text-fg font-medium">{item?.title}</span>? A waived required
          step counts as settled. A reason is required.
        </p>
        <div>
          <label className="block text-xs text-fg-muted mb-1">Reason <span className="text-danger">*</span></label>
          <textarea
            required
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Why this step doesn't apply"
            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !note.trim()}
            className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary-fg text-sm font-medium rounded-nb"
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
        <p className="text-sm text-fg-muted">
          Attach the collected document for{' '}
          <span className="text-fg font-medium">{item?.title}</span>. It is filed into the
          person's documents and the step is marked done.
        </p>
        <div>
          <label className="block text-xs text-fg-muted mb-1">File name <span className="text-danger">*</span></label>
          <input
            required
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            placeholder="e.g. passport.pdf"
            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">Link to the file (optional)</label>
          <input
            value={fileUrl}
            onChange={e => setFileUrl(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !fileName.trim()}
            className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary-fg text-sm font-medium rounded-nb"
          >
            {busy ? 'Attaching…' : 'Attach & Mark Done'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PersonOnboardingTab;
