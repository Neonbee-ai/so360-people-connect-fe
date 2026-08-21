import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, Plus, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import {
  toast,
  getErrorMessage,
  Drawer,
  DataTable,
  DeleteConfirmDialog,
  type DataTableColumn,
} from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
  onboardingApi,
  ONBOARDING_ITEM_TYPES,
  ONBOARDING_ASSIGNEE_ROLES,
  type OnboardingTemplate,
  type OnboardingItemType,
  type OnboardingAssigneeRole,
  type TemplateItemPayload,
  type CreateTemplatePayload,
} from '../../services/onboardingService';

const ITEM_TYPE_LABELS: Record<OnboardingItemType, string> = {
  task: 'Task',
  meeting: 'Meeting',
  document_upload: 'Document upload',
  e_sign: 'eSignature',
};

const ASSIGNEE_LABELS: Record<OnboardingAssigneeRole, string> = {
  hr: 'HR',
  manager: 'Manager',
  employee: 'Employee',
};

/**
 * Settings → Onboarding Templates.
 *
 * Builds the reusable checklists new-hire onboarding instantiates from. The
 * item editor is a plain ordered list — sort_order is derived from row
 * position on save, and PATCH `items` REPLACES the whole list server-side
 * (in-flight instances keep their snapshots, so editing here is always safe).
 */
const OnboardingTemplatesPage: React.FC = () => {
  const shell = useShellBridge() as any;
  // Writes need onboarding.manage; fail open while permissions resolve
  // (mirrors useCanViewCompensation), fail closed once loaded.
  const canManage = !shell?.permissionsLoaded
    ? true
    : (shell?.hasPermission?.('onboarding.manage') ?? true);

  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<OnboardingTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OnboardingTemplate | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await onboardingApi.listTemplates();
      setTemplates(result.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load onboarding templates'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSaved = () => {
    setShowDrawer(false);
    setEditing(null);
    void load();
  };

  const handleDeleteConfirmed = async (tpl: OnboardingTemplate) => {
    setDeleteBusy(true);
    try {
      const result = await onboardingApi.deleteTemplate(tpl.id);
      toast.success(
        result.deactivated
          ? `"${tpl.name}" is in use, so it was deactivated instead of deleted`
          : `Template "${tpl.name}" deleted`,
      );
      void load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete template'));
    } finally {
      setDeleteBusy(false);
      setConfirmDelete(null);
    }
  };

  const columns: DataTableColumn<OnboardingTemplate>[] = [
    {
      key: 'name',
      header: 'Name',
      render: tpl => (
        <div>
          <span className="font-medium text-slate-50">{tpl.name}</span>
          {tpl.description && <p className="text-xs text-slate-500">{tpl.description}</p>}
        </div>
      ),
    },
    {
      key: 'is_default',
      header: 'Default',
      render: tpl =>
        tpl.is_default ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Default
          </span>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: tpl => (
        <span className={`text-xs ${tpl.is_active ? 'text-teal-400' : 'text-slate-500'}`}>
          {tpl.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    ...(canManage
      ? [{
          key: 'actions',
          header: 'Actions',
          render: (tpl: OnboardingTemplate) => (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(tpl)}
                className="p-1.5 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors"
                title="Edit"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => setConfirmDelete(tpl)}
                className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ),
        }]
      : []),
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Onboarding Templates"
        subtitle="Checklists that guide every new hire's first weeks"
        actions={
          canManage && (
            <button
              onClick={() => setShowDrawer(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              New Template
            </button>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={templates}
        rowKey={tpl => tpl.id}
        loading={loading}
        emptyState={
          <EmptyState
            icon={ClipboardCheck}
            title="No onboarding templates"
            description="Create a checklist of tasks, meetings, documents and signatures for new hires. Mark one template as default to start it automatically."
            action={canManage ? { label: 'New Template', onClick: () => setShowDrawer(true) } : undefined}
          />
        }
      />

      <TemplateDrawer
        isOpen={showDrawer || !!editing}
        onClose={() => { setShowDrawer(false); setEditing(null); }}
        onSaved={handleSaved}
        template={editing}
      />

      <DeleteConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDeleteConfirmed(confirmDelete)}
        title="Delete Onboarding Template"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? If onboarding has ever been started from it, it will be deactivated instead so those records stay intact.` : ''}
        confirmText="Delete Template"
        isLoading={deleteBusy}
      />
    </div>
  );
};

// =============================================================================
// Template Drawer — create / edit with the checklist item builder
// =============================================================================

/** A row in the item editor. `key` is UI-only (stable identity for reorders). */
interface ItemRow extends TemplateItemPayload {
  key: string;
}

let rowSeq = 0;
const newRow = (partial?: Partial<TemplateItemPayload>): ItemRow => ({
  key: `row-${++rowSeq}`,
  title: '',
  item_type: 'task',
  assignee_role: 'hr',
  is_required: true,
  ...partial,
});

interface TemplateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  template: OnboardingTemplate | null;
}

const TemplateDrawer: React.FC<TemplateDrawerProps> = ({ isOpen, onClose, onSaved, template }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (template) {
      setName(template.name);
      setDescription(template.description ?? '');
      setIsDefault(template.is_default);
      setIsActive(template.is_active);
      setItems([]);
      setLoadingItems(true);
      // The list endpoint returns templates without items — fetch the detail.
      onboardingApi
        .getTemplate(template.id)
        .then(full => {
          setItems(
            [...(full.items ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(it =>
                newRow({
                  title: it.title,
                  description: it.description ?? undefined,
                  item_type: it.item_type,
                  assignee_role: it.assignee_role,
                  is_required: it.is_required,
                  due_days_offset: it.due_days_offset ?? undefined,
                  document_type: it.document_type ?? undefined,
                  sign_document_ref: it.sign_document_ref ?? undefined,
                }),
              ),
          );
        })
        .catch(err => toast.error(getErrorMessage(err, 'Failed to load template items')))
        .finally(() => setLoadingItems(false));
    } else {
      setName('');
      setDescription('');
      setIsDefault(false);
      setIsActive(true);
      setItems([newRow()]);
    }
  }, [template, isOpen]);

  const setItem = (key: string, patch: Partial<TemplateItemPayload>) =>
    setItems(prev => prev.map(row => (row.key === key ? { ...row, ...patch } : row)));

  const removeItem = (key: string) => setItems(prev => prev.filter(row => row.key !== key));

  const moveItem = (key: string, dir: -1 | 1) =>
    setItems(prev => {
      const idx = prev.findIndex(row => row.key === key);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const validItems = items.filter(row => row.title.trim());
    // sort_order is the row's position — the drag-free reorder contract.
    const payloadItems: TemplateItemPayload[] = validItems.map((row, index) => {
      const { key: _key, ...item } = row;
      return {
        ...item,
        title: item.title.trim(),
        description: item.description?.trim() || undefined,
        sort_order: index,
        document_type: item.item_type === 'document_upload' ? item.document_type || undefined : undefined,
        sign_document_ref: item.item_type === 'e_sign' ? item.sign_document_ref || undefined : undefined,
      };
    });
    const payload: CreateTemplatePayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      is_default: isDefault,
      is_active: isActive,
      items: payloadItems,
    };
    setSaving(true);
    try {
      if (template) {
        await onboardingApi.updateTemplate(template.id, payload);
        toast.success('Onboarding template updated');
      } else {
        await onboardingApi.createTemplate(payload);
        toast.success(`Onboarding template "${payload.name}" created`);
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save onboarding template'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500';
  const smallInputCls =
    'w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={template ? 'Edit Onboarding Template' : 'New Onboarding Template'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="onboarding-template-form"
            disabled={saving || loadingItems}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : template ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      }
    >
      <form id="onboarding-template-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Engineering New Hire"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What this checklist covers"
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)}
              className="rounded border-slate-600"
            />
            Default template
          </label>
          {template && (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="rounded border-slate-600"
              />
              Active
            </label>
          )}
        </div>
        {isDefault && (
          <p className="text-xs text-slate-500">
            The default template starts automatically for every new hire. Only one template can be default — saving replaces any existing default.
          </p>
        )}

        {/* Checklist items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Checklist Items</label>
            <button
              type="button"
              onClick={() => setItems(prev => [...prev, newRow()])}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-slate-50 hover:border-slate-600 transition-colors"
            >
              <Plus size={12} /> Add Item
            </button>
          </div>

          {loadingItems ? (
            <div className="space-y-2">
              <div className="h-20 animate-pulse rounded-lg bg-slate-800/50" />
              <div className="h-20 animate-pulse rounded-lg bg-slate-800/50" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-4 text-sm text-slate-500 text-center border border-dashed border-slate-800 rounded-lg">
              No items yet — add the first step of this checklist.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((row, index) => (
                <div key={row.key} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-xs text-slate-500 text-center">{index + 1}</span>
                    <input
                      value={row.title}
                      onChange={e => setItem(row.key, { title: e.target.value })}
                      placeholder="Step title, e.g. Sign employment contract"
                      aria-label={`Item ${index + 1} title`}
                      className={smallInputCls}
                    />
                    <button
                      type="button"
                      onClick={() => moveItem(row.key, -1)}
                      disabled={index === 0}
                      className="p-1 rounded text-slate-500 hover:text-teal-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
                      title="Move up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(row.key, 1)}
                      disabled={index === items.length - 1}
                      className="p-1 rounded text-slate-500 hover:text-teal-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
                      title="Move down"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(row.key)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-7">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Type</label>
                      <select
                        value={row.item_type}
                        onChange={e => setItem(row.key, { item_type: e.target.value as OnboardingItemType })}
                        aria-label={`Item ${index + 1} type`}
                        className={smallInputCls}
                      >
                        {ONBOARDING_ITEM_TYPES.map(t => (
                          <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Assignee</label>
                      <select
                        value={row.assignee_role}
                        onChange={e => setItem(row.key, { assignee_role: e.target.value as OnboardingAssigneeRole })}
                        aria-label={`Item ${index + 1} assignee`}
                        className={smallInputCls}
                      >
                        {ONBOARDING_ASSIGNEE_ROLES.map(r => (
                          <option key={r} value={r}>{ASSIGNEE_LABELS[r]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Due (days from start)</label>
                      <input
                        type="number"
                        min={0}
                        value={row.due_days_offset ?? ''}
                        onChange={e =>
                          setItem(row.key, {
                            due_days_offset: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                          })
                        }
                        placeholder="None"
                        aria-label={`Item ${index + 1} due days`}
                        className={smallInputCls}
                      />
                    </div>
                    <div className="flex items-end pb-1.5">
                      <label className="flex items-center gap-1.5 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={row.is_required ?? true}
                          onChange={e => setItem(row.key, { is_required: e.target.checked })}
                          className="rounded border-slate-600"
                        />
                        Required
                      </label>
                    </div>
                  </div>
                  {row.item_type === 'document_upload' && (
                    <div className="pl-7">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Document type collected</label>
                      <input
                        value={row.document_type ?? ''}
                        onChange={e => setItem(row.key, { document_type: e.target.value })}
                        placeholder="e.g. passport, degree_certificate"
                        className={smallInputCls}
                      />
                    </div>
                  )}
                  {row.item_type === 'e_sign' && (
                    <div className="pl-7">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Sign document reference</label>
                      <input
                        value={row.sign_document_ref ?? ''}
                        onChange={e => setItem(row.key, { sign_document_ref: e.target.value })}
                        placeholder="Sign template/document reference"
                        className={smallInputCls}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Drawer>
  );
};

export default OnboardingTemplatesPage;
