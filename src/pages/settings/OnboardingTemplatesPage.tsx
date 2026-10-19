import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import {
  toast,
  getErrorMessage,
  Drawer,
  DataTable,
  DeleteConfirmDialog,
  type DataTableColumn,
  ListPageTemplate,
  Button,
  IconButton,
  Badge,
  Alert,
  Card,
  Stack,
  Cluster,
  Grid,
  Select,
  TextField,
  NumberInput,
  Checkbox,
  Skeleton,
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
  type StandardOnboardingTemplate,
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
  const [showCatalog, setShowCatalog] = useState(false);

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

  // The whole reason "Start onboarding" used to dead-end: templates can exist
  // while none is default, and nothing on this page said so. Only surfaced once
  // loading settles, so it never flashes during the initial fetch.
  const hasActiveTemplates = templates.some(t => t.is_active);
  const missingDefault = !loading && hasActiveTemplates && !templates.some(t => t.is_default && t.is_active);

  const handleSeeded = () => {
    setShowCatalog(false);
    void load();
  };

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
        <Stack gap="tight">
          <span className="text-nb-sm font-medium text-fg">{tpl.name}</span>
          {tpl.description && <p className="text-nb-xs text-fg-subtle">{tpl.description}</p>}
        </Stack>
      ),
    },
    {
      key: 'is_default',
      header: 'Default',
      render: tpl =>
        tpl.is_default ? (
          <Badge tone="primary">Default</Badge>
        ) : (
          <span className="text-nb-xs text-fg-subtle">—</span>
        ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: tpl => (
        <span className={`text-nb-xs ${tpl.is_active ? 'text-primary' : 'text-fg-subtle'}`}>
          {tpl.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    ...(canManage
      ? [{
          key: 'actions',
          header: 'Actions',
          render: (tpl: OnboardingTemplate) => (
            <Cluster gap="tight">
              <IconButton name={`onboarding-edit-${tpl.id}`} variant="ghost" size="sm" label="Edit" icon={<Edit2 size={14} />} onClick={() => setEditing(tpl)} />
              <IconButton name={`onboarding-delete-${tpl.id}`} variant="ghost" size="sm" label="Delete" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(tpl)} />
            </Cluster>
          ),
        }]
      : []),
  ];

  return (
    <ListPageTemplate
      title="Onboarding Templates"
      description="Checklists that guide every new hire's first weeks"
      headerSecondaryActions={
        canManage ? [
          <Button key="standard-templates" type="button" variant="secondary" onClick={() => setShowCatalog(true)}>
            <Sparkles size={16} />
            Standard Templates
          </Button>
        ] : undefined
      }
      primaryAction={
        canManage ? (
          <Button type="button" onClick={() => setShowDrawer(true)}>
            <Plus size={16} />
            New Template
          </Button>
        ) : undefined
      }
      toolbar={
        missingDefault ? (
          <Alert variant="warning" title="No default onboarding template">
            New hires won't get a checklist automatically, and{' '}
            <span className="font-medium">Start onboarding</span> will ask for a template every
            time. Edit a template below and tick{' '}
            <span className="font-medium">Set as the organization default</span> to fix this.
          </Alert>
        ) : undefined
      }
    >
      <DataTable
        columns={columns}
        rows={templates}
        rowKey={tpl => tpl.id}
        loading={loading}
        emptyState={
          <EmptyState
            icon={ClipboardCheck}
            title="No onboarding templates"
            description="Start from one of the standard checklists and edit it to fit, or build your own from scratch. Whichever you pick, mark one as default so new hires get it automatically."
            action={canManage ? { label: 'Use a Standard Template', onClick: () => setShowCatalog(true) } : undefined}
            secondaryAction={canManage ? { label: 'Build from scratch', onClick: () => setShowDrawer(true) } : undefined}
          />
        }
      />

      <StandardCatalogDrawer
        isOpen={showCatalog}
        onClose={() => setShowCatalog(false)}
        onSeeded={handleSeeded}
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
    </ListPageTemplate>
  );
};

// =============================================================================
// Standard Catalog Drawer — copy NeonBee's starting points into this org
// =============================================================================

interface StandardCatalogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSeeded: () => void;
}

/**
 * Seeding COPIES catalog entries in; it never links to shared rows. Once
 * copied they are ordinary org templates — editing them is safe and a later
 * platform update will not overwrite the edits. Entries already taken come back
 * with `already_seeded`, are shown ticked and disabled, and the backend skips
 * them anyway, so a double-submit cannot duplicate anything.
 */
const StandardCatalogDrawer: React.FC<StandardCatalogDrawerProps> = ({ isOpen, onClose, onSeeded }) => {
  const [catalog, setCatalog] = useState<StandardOnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await onboardingApi.listStandardTemplates();
      setCatalog(result.data);
      // Preselect what the org doesn't have yet — the common case is "give me
      // the ones I'm missing", and preselecting seeded rows would be a lie.
      setSelected(result.data.filter(t => !t.already_seeded).map(t => t.key));
    } catch (err) {
      setFailed(true);
      toast.error(getErrorMessage(err, 'Failed to load the standard template catalog'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadCatalog();
  }, [isOpen, loadCatalog]);

  const toggle = (key: string) =>
    setSelected(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const handleSeed = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const result = await onboardingApi.seedStandardTemplates(selected);
      if (result.created_count === 0) {
        toast.info('Those templates were already added — nothing to copy.');
      } else {
        toast.success(
          `Added ${result.created_count} template${result.created_count === 1 ? '' : 's'}` +
            (result.has_default ? '' : ' — set one as default to start onboarding automatically'),
        );
      }
      onSeeded();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add standard templates'));
    } finally {
      setSaving(false);
    }
  };

  const available = catalog.filter(t => !t.already_seeded).length;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Standard Onboarding Templates"
      footer={
        <Cluster gap="tight" justify="end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleSeed} disabled={saving || loading || selected.length === 0}>
            {saving
              ? 'Adding…'
              : `Add ${selected.length || ''} Template${selected.length === 1 ? '' : 's'}`.trim()}
          </Button>
        </Cluster>
      }
    >
      <Stack gap="default">
        <p className="text-nb-sm text-fg-muted">
          Ready-made checklists you can use as-is or edit. They are copied into your organization,
          so any changes you make stay yours.
        </p>

        {loading ? (
          <Stack gap="tight">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} />
            ))}
          </Stack>
        ) : failed ? (
          <Card>
            <Stack gap="default" align="center">
              <p className="text-nb-sm text-fg-muted">Unable to load the standard templates.</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => void loadCatalog()}>
                Try again
              </Button>
            </Stack>
          </Card>
        ) : available === 0 ? (
          <Card>
            <p className="text-nb-sm text-fg-muted">
              You've already added every standard template. Use{' '}
              <span className="font-medium text-fg">New Template</span> to build your own.
            </p>
          </Card>
        ) : (
          <Stack gap="tight">
            {catalog.map(tpl => {
              const isSelected = selected.includes(tpl.key);
              return (
                <Card key={tpl.key}>
                  <Stack gap="tight">
                    <Checkbox
                      name={`standard-template-${tpl.key}`}
                      label={tpl.name}
                      checked={tpl.already_seeded || isSelected}
                      disabled={tpl.already_seeded}
                      onChange={() => toggle(tpl.key)}
                    />
                    <Cluster gap="tight">
                      <span className="text-nb-xs text-fg-subtle">{tpl.step_count} steps</span>
                      {tpl.already_seeded && <Badge tone="neutral">Already added</Badge>}
                    </Cluster>
                    <span className="text-nb-xs text-fg-subtle">{tpl.description}</span>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Drawer>
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

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={template ? 'Edit Onboarding Template' : 'New Onboarding Template'}
      size="lg"
      footer={
        <Cluster gap="default" justify="end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="onboarding-template-form" disabled={saving || loadingItems}>
            {saving ? 'Saving…' : template ? 'Save Changes' : 'Create Template'}
          </Button>
        </Cluster>
      }
    >
      <form id="onboarding-template-form" onSubmit={handleSubmit}>
        <Stack gap="default">
          <TextField
            name="onboarding-template-name"
            label="Name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Engineering New Hire"
          />
          <TextField
            name="onboarding-template-description"
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What this checklist covers"
          />
          <Cluster gap="region">
            <Checkbox
              name="onboarding-template-default"
              label="Default template"
              checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)}
            />
            {template && (
              <Checkbox
                name="onboarding-template-active"
                label="Active"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
              />
            )}
          </Cluster>
          {isDefault && (
            <p className="text-nb-xs text-fg-subtle">
              The default template starts automatically for every new hire. Only one template can be default — saving replaces any existing default.
            </p>
          )}

          {/* Checklist items */}
          <Stack gap="tight">
            <Cluster gap="tight" justify="between">
              <span className="text-nb-sm font-semibold text-fg">Checklist Items</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => setItems(prev => [...prev, newRow()])}>
                <Plus size={12} /> Add Item
              </Button>
            </Cluster>

            {loadingItems ? (
              <Stack gap="tight">
                <Skeleton />
                <Skeleton />
              </Stack>
            ) : items.length === 0 ? (
              <p className="p-nb-4 text-nb-sm text-fg-subtle text-center">
                No items yet — add the first step of this checklist.
              </p>
            ) : (
              <Stack gap="tight">
                {items.map((row, index) => (
                  <Card key={row.key}>
                    <Stack gap="tight">
                      <Cluster gap="tight">
                        <span className="text-nb-xs text-fg-subtle">{index + 1}</span>
                        <TextField
                          name={`onboarding-item-title-${row.key}`}
                          value={row.title}
                          onChange={e => setItem(row.key, { title: e.target.value })}
                          placeholder="Step title, e.g. Sign employment contract"
                          aria-label={`Item ${index + 1} title`}
                        />
                        <IconButton name={`onboarding-item-up-${row.key}`} variant="ghost" size="sm" label="Move up" icon={<ArrowUp size={13} />} onClick={() => moveItem(row.key, -1)} disabled={index === 0} />
                        <IconButton name={`onboarding-item-down-${row.key}`} variant="ghost" size="sm" label="Move down" icon={<ArrowDown size={13} />} onClick={() => moveItem(row.key, 1)} disabled={index === items.length - 1} />
                        <IconButton name={`onboarding-item-remove-${row.key}`} variant="ghost" size="sm" label="Remove item" icon={<Trash2 size={13} />} onClick={() => removeItem(row.key)} />
                      </Cluster>
                      <Grid columns={4} gap="sm">
                        <Select name={`onboarding-item-type-${row.key}`} label="Type" value={row.item_type} onChange={e => setItem(row.key, { item_type: e.target.value as OnboardingItemType })} aria-label={`Item ${index + 1} type`} options={[...ONBOARDING_ITEM_TYPES.map((t) => ({ value: t, label: ITEM_TYPE_LABELS[t] }))]} />
                        <Select name={`onboarding-item-assignee-${row.key}`} label="Assignee" value={row.assignee_role} onChange={e => setItem(row.key, { assignee_role: e.target.value as OnboardingAssigneeRole })} aria-label={`Item ${index + 1} assignee`} options={[...ONBOARDING_ASSIGNEE_ROLES.map((r) => ({ value: r, label: ASSIGNEE_LABELS[r] }))]} />
                        <NumberInput
                          name={`onboarding-item-due-${row.key}`}
                          label="Due (days from start)"
                          min={0}
                          value={row.due_days_offset ?? null}
                          onChange={v => setItem(row.key, { due_days_offset: v == null ? undefined : Math.trunc(v) })}
                          placeholder="None"
                          aria-label={`Item ${index + 1} due days`}
                        />
                        <Checkbox
                          name={`onboarding-item-required-${row.key}`}
                          label="Required"
                          checked={row.is_required ?? true}
                          onChange={e => setItem(row.key, { is_required: e.target.checked })}
                        />
                      </Grid>
                      {row.item_type === 'document_upload' && (
                        <TextField
                          name={`onboarding-item-doctype-${row.key}`}
                          label="Document type collected"
                          value={row.document_type ?? ''}
                          onChange={e => setItem(row.key, { document_type: e.target.value })}
                          placeholder="e.g. passport, degree_certificate"
                        />
                      )}
                      {row.item_type === 'e_sign' && (
                        <TextField
                          name={`onboarding-item-signref-${row.key}`}
                          label="Sign document reference"
                          value={row.sign_document_ref ?? ''}
                          onChange={e => setItem(row.key, { sign_document_ref: e.target.value })}
                          placeholder="Sign template/document reference"
                        />
                      )}
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Stack>
      </form>
    </Drawer>
  );
};

export default OnboardingTemplatesPage;
