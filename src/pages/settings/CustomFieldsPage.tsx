import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, ListChecks, ArrowUp, ArrowDown, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import { toast } from '@so360/design-system';
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

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Employee Custom Fields"
        subtitle="Define additional fields to capture on the Person record — they appear on the Add/Edit Person form"
        actions={
          canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Custom Field
            </button>
          )
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
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
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Label</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Required</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Active</th>
                {canManage && <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row, index) => (
                <tr key={row.id} data-testid={`custom-field-row-${row.field_key}`} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-50">
                    {row.label}
                    <div className="text-xs text-slate-500">{row.field_key}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{FIELD_TYPE_LABELS[row.field_type]}</td>
                  <td className="px-4 py-3 text-slate-400">{row.is_required ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <button
                        onClick={() => handleToggleActive(row)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${row.is_active ? 'bg-teal-600' : 'bg-slate-700'}`}
                        title={row.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${row.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    ) : (
                      <span className={`text-xs ${row.is_active ? 'text-teal-400' : 'text-slate-500'}`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMove(index, -1)}
                          disabled={index === 0}
                          className="p-1.5 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Move up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => handleMove(index, 1)}
                          disabled={index === rows.length - 1}
                          className="p-1.5 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Move down"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => setEditing(row)}
                          className="p-1.5 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomFieldFormModal
        isOpen={showModal || !!editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        row={editing}
      />
    </div>
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={row ? `Edit ${row.label}` : 'Add Custom Field'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Label <span className="text-red-400">*</span></label>
          <input
            required
            value={form.label}
            onChange={e => set('label', e.target.value)}
            placeholder="e.g. Blood Group"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Field Type <span className="text-red-400">*</span></label>
          <select
            value={form.field_type}
            disabled={!!row}
            onChange={e => set('field_type', e.target.value as CustomFieldType)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500 disabled:opacity-60"
          >
            {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {row && <p className="text-xs text-slate-500 mt-1">Field type can't be changed after creation to avoid stranding recorded values.</p>}
        </div>

        {isChoiceType && (
          <div data-testid="options-editor">
            <label className="block text-xs text-slate-400 mb-1">Options</label>
            <div className="flex gap-2 mb-2">
              <input
                value={optionInput}
                onChange={e => setOptionInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                placeholder="Type an option and press Enter"
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
              <button
                type="button"
                onClick={addOption}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-slate-50 hover:border-teal-500 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(form.options || []).map(option => (
                <span key={option} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300">
                  {option}
                  <button type="button" onClick={() => removeOption(option)} className="text-slate-500 hover:text-red-400">
                    <X size={12} />
                  </button>
                </span>
              ))}
              {(form.options || []).length === 0 && (
                <span className="text-xs text-slate-500">No options added yet.</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400">Required</label>
          <button
            type="button"
            onClick={() => set('is_required', !form.is_required)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_required ? 'bg-teal-600' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${form.is_required ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>

        {row && (
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400">Active</label>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-teal-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {row ? 'Save Changes' : 'Add Custom Field'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CustomFieldsPage;
