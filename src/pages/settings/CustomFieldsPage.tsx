import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, ListChecks, ArrowUp, ArrowDown, X } from 'lucide-react';
import {
  Badge, Button, Cluster, DataTable, EmptyState, Modal, Select, SettingsPageTemplate, Skeleton, Stack, Switch, TextField, toast,
} from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
  customFieldDefsApi,
  CustomFieldDef,
  CreateCustomFieldDefPayload,
  CustomFieldType,
  CHOICE_FIELD_TYPES,
} from '../../services/customFieldsService';

// Admin builder for org-defined extra fields on the Person record (e.g.
// Blood Group, Passport Expiry, Vehicle Number, Emergency Contact 2).
// Rendered at settings/custom-fields; the same definitions are consumed by
// PeoplePage's Add/Edit Person modal to render one input per active field.

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  dropdown: 'Dropdown',
  date: 'Date',
  checkbox: 'Checkbox',
  multi_select: 'Multi Select',
};

const BLANK: CreateCustomFieldDefPayload = {
  field_key: '',
  label: '',
  field_type: 'text',
  options: [],
  is_required: false,
  is_active: true,
};

const CustomFieldsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) &&
    (shell?.isFeatureEnabled?.('action:people:employee_custom_fields:manage') ?? true);

  const [rows, setRows] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDef | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const result = await customFieldDefsApi.getAll({ includeInactive: true });
      setRows((result.data ?? []).sort((a, b) => a.sort_order - b.sort_order));
    } catch {
      setLoadError(true);
      toast.error('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: CreateCustomFieldDefPayload) => {
    try {
      await customFieldDefsApi.create({ ...data, sort_order: rows.length });
      setShowModal(false);
      toast.success(`Custom field "${data.label}" created`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create custom field');
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateCustomFieldDefPayload>) => {
    try {
      await customFieldDefsApi.update(id, data);
      setEditing(null);
      toast.success('Custom field updated');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update custom field');
    }
  };

  const handleToggleActive = async (row: CustomFieldDef) => {
    await handleUpdate(row.id, { is_active: !row.is_active });
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await customFieldDefsApi.delete(id);
      toast.success(result.message);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete custom field');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const reordered = [...rows];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setRows(reordered);
    try {
      await Promise.all(
        reordered.map((row, idx) =>
          row.sort_order === idx ? Promise.resolve() : customFieldDefsApi.update(row.id, { sort_order: idx }),
        ),
      );
      load();
    } catch {
      toast.error('Failed to reorder custom fields');
      load();
    }
  };

  const columns = [
    {
      key: 'label',
      header: 'Label',
      render: (row: CustomFieldDef) => (
        <Stack gap="none">
          <span className="font-medium text-fg" data-testid={`custom-field-row-${row.field_key}`}>{row.label}</span>
          <span className="text-nb-xs text-fg-subtle">{row.field_key}</span>
        </Stack>
      ),
    },
    { key: 'field_type', header: 'Type', render: (row: CustomFieldDef) => FIELD_TYPE_LABELS[row.field_type] },
    { key: 'is_required', header: 'Required', render: (row: CustomFieldDef) => (row.is_required ? 'Yes' : 'No') },
    {
      key: 'is_active',
      header: 'Active',
      render: (row: CustomFieldDef) =>
        canManage ? (
          <Switch
            name={`active_${row.field_key}`}
            label={row.is_active ? 'Deactivate' : 'Activate'}
            hideLabel
            checked={row.is_active}
            onCheckedChange={() => handleToggleActive(row)}
          />
        ) : (
          <Badge tone={row.is_active ? 'primary' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
        ),
    },
    ...(canManage
      ? [{
          key: 'actions',
          header: 'Actions',
          render: (row: CustomFieldDef) => {
            const index = rows.findIndex(r => r.id === row.id);
            return (
              <Cluster gap="tight">
                <Button variant="ghost" size="sm" aria-label="Move up" title="Move up" disabled={index === 0} onClick={() => handleMove(index, -1)}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" aria-label="Move down" title="Move down" disabled={index === rows.length - 1} onClick={() => handleMove(index, 1)}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" aria-label="Edit" title="Edit" onClick={() => setEditing(row)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" aria-label="Delete" title="Delete" onClick={() => handleDelete(row.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Cluster>
            );
          },
        }]
      : []),
  ];

  const addAction = canManage ? (
    <Button variant="primary" onClick={() => setShowModal(true)} className="gap-nb-2">
      <Plus className="w-4 h-4" />
      Add Custom Field
    </Button>
  ) : undefined;

  return (
    <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
      title="Employee Custom Fields"
      description="Define additional fields to capture on the Person record — they appear on the Add/Edit Person form"
      primaryAction={addAction}
    >
      {loading ? (
        <Stack gap="default">
          <Skeleton variant="rect" />
          <Skeleton variant="rect" />
          <Skeleton variant="rect" />
        </Stack>
      ) : loadError ? (
        <EmptyState
          icon={ListChecks}
          title="Couldn't load custom fields"
          description="Something went wrong fetching this list. Try refreshing the page."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No custom fields"
          description="Add your first custom field (e.g. Blood Group, Passport Expiry) to get started."
          action={canManage ? { label: 'Add Custom Field', onClick: () => setShowModal(true) } : undefined}
        />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r: CustomFieldDef) => r.id} />
      )}

      <CustomFieldFormModal
        isOpen={showModal || !!editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        row={editing}
      />
    </SettingsPageTemplate>
  );
};

// =============================================================================
// Custom Field Form Modal — add/edit form; Options editor only shown for
// dropdown/multi_select field types.
// =============================================================================

interface CustomFieldFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateCustomFieldDefPayload) => void;
  onUpdate: (id: string, data: Partial<CreateCustomFieldDefPayload>) => void;
  row: CustomFieldDef | null;
}

const slugify = (label: string): string =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const CustomFieldFormModal: React.FC<CustomFieldFormModalProps> = ({ isOpen, onClose, onCreate, onUpdate, row }) => {
  const [form, setForm] = useState<CreateCustomFieldDefPayload>(BLANK);
  const [optionInput, setOptionInput] = useState('');

  useEffect(() => {
    if (row) {
      setForm({
        field_key: row.field_key,
        label: row.label,
        field_type: row.field_type,
        options: row.options || [],
        is_required: row.is_required,
        is_active: row.is_active,
      });
    } else {
      setForm(BLANK);
    }
    setOptionInput('');
  }, [row, isOpen]);

  const set = (field: keyof CreateCustomFieldDefPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const isChoiceType = CHOICE_FIELD_TYPES.includes(form.field_type);

  const addOption = () => {
    const value = optionInput.trim();
    if (!value) return;
    if ((form.options || []).includes(value)) {
      setOptionInput('');
      return;
    }
    set('options', [...(form.options || []), value]);
    setOptionInput('');
  };

  const removeOption = (value: string) => {
    set('options', (form.options || []).filter(o => o !== value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    const payload: CreateCustomFieldDefPayload = {
      ...form,
      field_key: row ? form.field_key : (form.field_key || slugify(form.label)),
      options: isChoiceType ? form.options : undefined,
    };
    if (row) {
      onUpdate(row.id, payload);
    } else {
      onCreate(payload);
    }
  };

  const formId = 'custom-field-form';
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      name="custom-field-modal"
      title={row ? `Edit ${row.label}` : 'Add Custom Field'}
      size="md"
      footer={
        <Cluster gap="default">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary">{row ? 'Save Changes' : 'Add Custom Field'}</Button>
        </Cluster>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <Stack gap="default">
          <TextField
            name="label"
            label="Label"
            required
            value={form.label}
            onChange={e => set('label', e.target.value)}
            placeholder="e.g. Blood Group"
          />

          <Select
            name="field_type"
            label="Field Type"
            required
            value={form.field_type}
            disabled={!!row}
            onChange={e => set('field_type', e.target.value as CustomFieldType)}
            options={Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            hint={row ? "Field type can't be changed after creation to avoid stranding recorded values." : undefined}
          />

          {isChoiceType && (
            <div data-testid="options-editor">
              <Stack gap="tight">
                <Cluster gap="tight">
                  <TextField
                    name="option_input"
                    label="Options"
                    value={optionInput}
                    onChange={e => setOptionInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                    placeholder="Type an option and press Enter"
                  />
                  <Button type="button" variant="secondary" onClick={addOption}>Add</Button>
                </Cluster>
                <Cluster gap="tight">
                  {(form.options || []).map(option => (
                    <Badge key={option} tone="neutral">
                      {option}
                      <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${option}`} onClick={() => removeOption(option)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                  {(form.options || []).length === 0 && (
                    <span className="text-nb-xs text-fg-subtle">No options added yet.</span>
                  )}
                </Cluster>
              </Stack>
            </div>
          )}

          <Switch
            name="is_required"
            label="Required"
            checked={!!form.is_required}
            onCheckedChange={v => set('is_required', v)}
          />

          {row && (
            <Switch
              name="is_active"
              label="Active"
              checked={!!form.is_active}
              onCheckedChange={v => set('is_active', v)}
            />
          )}
        </Stack>
      </form>
    </Modal>
  );
};

export default CustomFieldsPage;
