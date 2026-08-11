import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Settings, LucideIcon } from 'lucide-react';
import PageHeader from './PageHeader';
import EmptyState from './EmptyState';
import Modal from './Modal';
import { toast } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
  mastersApi,
  MasterRow,
  MasterType,
  CreateMasterPayload,
} from '../services/mastersService';

// Generic CRUD list page shared by all five People Connect master-data
// screens (Designations, Employment Types, Skills, Employee Status,
// Document Types). Each screen is a thin wrapper passing masterType + label
// (+ optional level/grade columns for Designations) instead of duplicating
// this page five times.

export interface MasterListPageProps {
  masterType: MasterType;
  label: string;
  pluralLabel?: string;
  icon?: LucideIcon;
  description?: string;
  /** Designations use Level + Grade; other lists omit them. */
  showLevelGrade?: boolean;
  /** Feature flag gating create/edit/delete — defaults to the shared people action flag. */
  manageFlagKey?: string;
}

const BLANK: CreateMasterPayload = { name: '', level: '', grade: '', is_active: true };

const MasterListPage: React.FC<MasterListPageProps> = ({
  masterType,
  label,
  pluralLabel,
  icon,
  description,
  showLevelGrade = false,
  manageFlagKey = 'action:people:employees:create',
}) => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.(manageFlagKey) ?? true);
  const plural = pluralLabel || `${label}s`;
  const Icon = icon || Settings;

  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MasterRow | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const result = await mastersApi.getAll(masterType, { includeInactive: true });
      setRows(result.data ?? []);
    } catch {
      setLoadError(true);
      toast.error(`Failed to load ${plural.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [masterType, plural]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: CreateMasterPayload) => {
    try {
      await mastersApi.create(masterType, data);
      setShowModal(false);
      toast.success(`${label} "${data.name}" created`);
      load();
    } catch {
      toast.error(`Failed to create ${label.toLowerCase()}`);
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateMasterPayload>) => {
    try {
      await mastersApi.update(masterType, id, data);
      setEditing(null);
      toast.success(`${label} updated`);
      load();
    } catch {
      toast.error(`Failed to update ${label.toLowerCase()}`);
    }
  };

  const handleToggleActive = async (row: MasterRow) => {
    await handleUpdate(row.id, { is_active: !row.is_active });
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await mastersApi.delete(masterType, id);
      toast.success(result.message);
      load();
    } catch {
      toast.error(`Failed to delete ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title={plural}
        subtitle={description || `Manage the ${plural.toLowerCase()} available across People Connect`}
        actions={
          canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add {label}
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
          icon={Icon}
          title={`Couldn't load ${plural.toLowerCase()}`}
          description="Something went wrong fetching this list. Try refreshing the page."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`No ${plural.toLowerCase()}`}
          description={`Add your first ${label.toLowerCase()} to get started.`}
          action={canManage ? { label: `Add ${label}`, onClick: () => setShowModal(true) } : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                {showLevelGrade && (
                  <>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Level</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Grade</th>
                  </>
                )}
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Active</th>
                {canManage && <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map(row => (
                <tr key={row.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-50">{row.name}</td>
                  {showLevelGrade && (
                    <>
                      <td className="px-4 py-3 text-slate-400">{row.level || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{row.grade || '—'}</td>
                    </>
                  )}
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

      <MasterFormModal
        isOpen={showModal || !!editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        row={editing}
        label={label}
        showLevelGrade={showLevelGrade}
      />
    </div>
  );
};

// =============================================================================
// Master Form Modal — shared add/edit form for every master-data list
// =============================================================================

interface MasterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateMasterPayload) => void;
  onUpdate: (id: string, data: Partial<CreateMasterPayload>) => void;
  row: MasterRow | null;
  label: string;
  showLevelGrade: boolean;
}

const MasterFormModal: React.FC<MasterFormModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  row,
  label,
  showLevelGrade,
}) => {
  const [form, setForm] = useState<CreateMasterPayload>(BLANK);

  useEffect(() => {
    if (row) {
      setForm({ name: row.name, level: row.level || '', grade: row.grade || '', is_active: row.is_active });
    } else {
      setForm(BLANK);
    }
  }, [row]);

  const set = (field: keyof CreateMasterPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (row) {
      onUpdate(row.id, form);
    } else {
      onCreate(form);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={row ? `Edit ${label}` : `Add ${label}`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder={`e.g. ${label}`}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        {showLevelGrade && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Level</label>
              <input
                value={form.level || ''}
                onChange={e => set('level', e.target.value)}
                placeholder="e.g. Mid"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Grade</label>
              <input
                value={form.grade || ''}
                onChange={e => set('grade', e.target.value)}
                placeholder="e.g. L3"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        )}
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
            {row ? 'Save Changes' : `Add ${label}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MasterListPage;
