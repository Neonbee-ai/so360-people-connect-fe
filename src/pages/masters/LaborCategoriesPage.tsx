import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, UserCog } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import { Alert, toast, getErrorMessage } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
  laborCategoriesApi,
  LaborCategory,
  CreateLaborCategoryPayload,
} from '../../services/laborCategoriesService';

/**
 * Labor Categories master data.
 *
 * Not built on MasterListPage: that component is hard-wired to the generic
 * /masters/:type API and its name/level/grade shape, whereas labor categories
 * carry a code, an hourly rate and an overtime multiplier and live behind their
 * own endpoint. It reuses the same PageHeader / EmptyState / Modal primitives so
 * the two read identically.
 *
 * A base_hourly_rate of 0 is legal but means UNCONFIGURED — a category with no
 * rate cannot cost an employee who also has no rate, which is what the Log Time
 * precheck reports as LABOR_CATEGORY_RATE_NOT_CONFIGURED. The list says so
 * explicitly instead of rendering a convincing "0.00".
 */

const BLANK: CreateLaborCategoryPayload = {
  name: '',
  code: '',
  description: '',
  base_hourly_rate: 0,
  overtime_multiplier: 1.5,
  is_active: true,
};

const LaborCategoriesPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage =
    shell?.effectiveFlagsLoaded !== false &&
    (shell?.isFeatureEnabled?.('action:people:labor_categories:create') ?? true);

  const [rows, setRows] = useState<LaborCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LaborCategory | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      setRows((await laborCategoriesApi.getAll()) ?? []);
    } catch {
      setLoadError(true);
      toast.error('Failed to load labor categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (data: CreateLaborCategoryPayload) => {
    try {
      await laborCategoriesApi.create(data);
      setShowModal(false);
      toast.success(`Labor category "${data.name}" created`);
      load();
    } catch (error) {
      // Surface the backend's own message — the duplicate-code guard names the
      // offending code, which a generic string would throw away.
      toast.error(getErrorMessage(error, 'Failed to create labor category'));
    }
  };

  const handleUpdate = async (
    id: string,
    data: Partial<CreateLaborCategoryPayload>,
  ) => {
    try {
      await laborCategoriesApi.update(id, data);
      setEditing(null);
      toast.success('Labor category updated');
      load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update labor category'));
    }
  };

  const handleDelete = async (row: LaborCategory) => {
    try {
      await laborCategoriesApi.remove(row.id);
      toast.success(`Labor category "${row.name}" deleted`);
      load();
    } catch (error) {
      // The backend refuses when time entries or employee defaults reference the
      // category and explains how many — pass that through verbatim.
      toast.error(getErrorMessage(error, 'Failed to delete labor category'));
    }
  };

  const unpricedCount = rows.filter(
    (r) => r.is_active && !(Number(r.base_hourly_rate) > 0),
  ).length;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Labor Categories"
        subtitle="Labor classifications and the standard rates used to cost time entries"
        actions={
          canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Labor Category
            </button>
          )
        }
      />

      {/* A category with no rate looks configured but cannot cost anyone, so say so. */}
      {!loading && !loadError && unpricedCount > 0 && (
        <Alert variant="warning" title="Rates not set">
          {unpricedCount === 1
            ? '1 active category has no hourly rate, so it cannot cost an employee who has no rate of their own.'
            : `${unpricedCount} active categories have no hourly rate, so they cannot cost employees who have no rate of their own.`}
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <EmptyState
          icon={UserCog}
          title="Couldn't load labor categories"
          description="Something went wrong fetching this list. Try refreshing the page."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No labor categories"
          description="Add your first labor category so time entries can be costed."
          action={
            canManage
              ? { label: 'Add Labor Category', onClick: () => setShowModal(true) }
              : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 text-left">
                {['Name', 'Code', 'Hourly Rate', 'Overtime', 'Active'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
                {canManage && (
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row) => {
                const priced = Number(row.base_hourly_rate) > 0;
                return (
                  <tr key={row.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-50">{row.name}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{row.code}</td>
                    <td className="px-4 py-3">
                      {priced ? (
                        <span className="text-slate-300">
                          {Number(row.base_hourly_rate).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-amber-400">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      &times;{Number(row.overtime_multiplier || 1.5)}
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <button
                          onClick={() => handleUpdate(row.id, { is_active: !row.is_active })}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${row.is_active ? 'bg-teal-600' : 'bg-slate-700'}`}
                          title={row.is_active ? 'Deactivate' : 'Activate'}
                          aria-label={row.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${row.is_active ? 'translate-x-5' : 'translate-x-1'}`}
                          />
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
                            aria-label={`Edit ${row.name}`}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                            title="Delete"
                            aria-label={`Delete ${row.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LaborCategoryFormModal
        isOpen={showModal || !!editing}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        row={editing}
      />
    </div>
  );
};

// =============================================================================

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateLaborCategoryPayload) => void;
  onUpdate: (id: string, data: Partial<CreateLaborCategoryPayload>) => void;
  row: LaborCategory | null;
}

const LaborCategoryFormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  row,
}) => {
  const [form, setForm] = useState<CreateLaborCategoryPayload>(BLANK);

  useEffect(() => {
    setForm(
      row
        ? {
            name: row.name,
            code: row.code,
            description: row.description || '',
            base_hourly_rate: Number(row.base_hourly_rate) || 0,
            overtime_multiplier: Number(row.overtime_multiplier) || 1.5,
            is_active: row.is_active,
          }
        : BLANK,
    );
  }, [row, isOpen]);

  const set = (field: keyof CreateLaborCategoryPayload, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    if (row) {
      // `code` is the org-unique key and is not editable — the backend rejects it.
      const { code, ...editable } = form;
      onUpdate(row.id, editable);
    } else {
      onCreate(form);
    }
  };

  const input =
    'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={row ? 'Edit Labor Category' : 'Add Labor Category'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1" htmlFor="lc-name">
              Name *
            </label>
            <input
              id="lc-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1" htmlFor="lc-code">
              Code *
            </label>
            <input
              id="lc-code"
              type="text"
              required
              disabled={!!row}
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              className={`${input} disabled:opacity-60 disabled:cursor-not-allowed`}
            />
            {row && (
              <p className="mt-1 text-xs text-slate-500">
                Code cannot be changed after creation.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1" htmlFor="lc-description">
            Description
          </label>
          <input
            id="lc-description"
            type="text"
            value={form.description || ''}
            onChange={(e) => set('description', e.target.value)}
            className={input}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1" htmlFor="lc-rate">
              Hourly Rate
            </label>
            <input
              id="lc-rate"
              type="number"
              min="0"
              step="0.01"
              value={form.base_hourly_rate}
              onChange={(e) => set('base_hourly_rate', parseFloat(e.target.value) || 0)}
              className={input}
            />
            {!(Number(form.base_hourly_rate) > 0) && (
              <p className="mt-1 text-xs text-amber-400">
                Leave at 0 only if this category should not price time.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1" htmlFor="lc-ot">
              Overtime Multiplier
            </label>
            <input
              id="lc-ot"
              type="number"
              min="1"
              step="0.1"
              value={form.overtime_multiplier}
              onChange={(e) => set('overtime_multiplier', parseFloat(e.target.value) || 1.5)}
              className={input}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {row ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default LaborCategoriesPage;
