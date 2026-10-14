import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, Plus, Edit2, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { toast, Drawer, DataTable, DeleteConfirmDialog, type DataTableColumn, Select } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { workLocationsApi, WorkLocation, CreateWorkLocationPayload, LocationType } from '../services/workLocationsService';

const LOCATION_TYPE_STYLES: Record<LocationType, { label: string; className: string }> = {
  factory: { label: 'Factory', className: 'bg-warning/10 text-warning border border-warning/20' },
  store: { label: 'Store', className: 'bg-primary/10 text-primary border border-primary/20' },
  office: { label: 'Office', className: 'bg-fg-subtle/10 text-fg-muted border border-fg-subtle/20' },
  remote: { label: 'Remote', className: 'bg-success/10 text-success border border-success/20' },
};

const LocationTypeBadge: React.FC<{ type: LocationType }> = ({ type }) => {
  const style = LOCATION_TYPE_STYLES[type] || LOCATION_TYPE_STYLES.office;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-nb-sm text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
};

const WorkLocationsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:create') ?? true);

  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<WorkLocation | null>(null);
  // Delete is destructive (or silently deactivates when people are assigned) —
  // never fire it straight off a single icon click.
  const [confirmDelete, setConfirmDelete] = useState<WorkLocation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Management view: inactive locations must stay visible, otherwise
      // deactivating one removes the only way to edit or reactivate it.
      const result = await workLocationsApi.getAll(true);
      setLocations(result.data);
    } catch {
      toast.error('Failed to load work locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: CreateWorkLocationPayload) => {
    try {
      await workLocationsApi.create(data);
      setShowDrawer(false);
      toast.success(`Work location "${data.name}" created`);
      load();
    } catch (err) {
      // Surface the server's reason — a duplicate-name rejection is only
      // actionable if the admin can read it.
      toast.error((err as Error)?.message || 'Failed to create work location');
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateWorkLocationPayload>) => {
    try {
      await workLocationsApi.update(id, data);
      setEditing(null);
      toast.success('Work location updated');
      load();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to update work location');
    }
  };

  const handleToggleActive = async (loc: WorkLocation) => {
    await handleUpdate(loc.id, { is_active: !loc.is_active });
  };

  const handleDeleteConfirmed = async (loc: WorkLocation) => {
    setDeleteBusy(true);
    try {
      const result = await workLocationsApi.delete(loc.id);
      toast.success(result.message);
      load();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to delete work location');
    } finally {
      setDeleteBusy(false);
      setConfirmDelete(null);
    }
  };

  const columns: DataTableColumn<WorkLocation>[] = [
    {
      key: 'name',
      header: 'Name',
      render: loc => <span className="font-medium text-fg">{loc.name}</span>,
    },
    {
      key: 'location_type',
      header: 'Type',
      render: loc => <LocationTypeBadge type={loc.location_type} />,
    },
    {
      key: 'address',
      header: 'Address',
      render: loc => <span className="text-fg-muted">{loc.address || '—'}</span>,
    },
    {
      key: 'is_active',
      header: 'Active',
      render: loc => canManage ? (
        <button
          onClick={() => handleToggleActive(loc)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${loc.is_active ? 'bg-primary' : 'bg-line'}`}
          title={loc.is_active ? 'Deactivate' : 'Activate'}
        >
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${loc.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      ) : (
        <span className={`text-xs ${loc.is_active ? 'text-primary' : 'text-fg-subtle'}`}>
          {loc.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    ...(canManage ? [{
      key: 'actions',
      header: 'Actions',
      render: (loc: WorkLocation) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(loc)}
            className="p-1.5 rounded text-fg-muted hover:text-primary hover:bg-surface-raised transition-colors"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => setConfirmDelete(loc)}
            className="p-1.5 rounded text-fg-muted hover:text-danger hover:bg-surface-raised transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Work Locations"
        subtitle="Define where your people work"
        actions={
          canManage && (
            <button
              onClick={() => setShowDrawer(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
            >
              <Plus size={16} />
              Add Location
            </button>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={locations}
        rowKey={loc => loc.id}
        loading={loading}
        emptyState={
          <EmptyState
            icon={MapPin}
            title="No work locations"
            description="Add locations like Factory, Store, Office, or Remote to assign to employees."
            action={canManage ? { label: 'Add Location', onClick: () => setShowDrawer(true) } : undefined}
          />
        }
      />

      <WorkLocationDrawer
        isOpen={showDrawer || !!editing}
        onClose={() => { setShowDrawer(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        location={editing}
      />

      <DeleteConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDeleteConfirmed(confirmDelete)}
        title="Delete Work Location"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? This cannot be undone. If employees are assigned to it, it will be deactivated instead so their records stay intact.` : ''}
        confirmText="Delete Location"
        isLoading={deleteBusy}
      />

    </div>
  );
};

// =============================================================================
// Work Location Drawer — create / edit form
// =============================================================================

interface WorkLocationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateWorkLocationPayload) => void;
  onUpdate: (id: string, data: Partial<CreateWorkLocationPayload>) => void;
  location: WorkLocation | null;
}

const BLANK: CreateWorkLocationPayload = { name: '', location_type: 'office', address: '', is_active: true };

const WorkLocationDrawer: React.FC<WorkLocationDrawerProps> = ({ isOpen, onClose, onCreate, onUpdate, location }) => {
  const [form, setForm] = useState<CreateWorkLocationPayload>(BLANK);

  useEffect(() => {
    if (location) {
      setForm({ name: location.name, location_type: location.location_type, address: location.address || '', is_active: location.is_active });
    } else {
      setForm(BLANK);
    }
  }, [location, isOpen]);

  const set = (field: keyof CreateWorkLocationPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (location) {
      onUpdate(location.id, form);
    } else {
      onCreate(form);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={location ? 'Edit Work Location' : 'Add Work Location'}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="work-location-form"
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
          >
            {location ? 'Save Changes' : 'Add Location'}
          </button>
        </div>
      }
    >
      <form id="work-location-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-fg-muted mb-1">Name <span className="text-danger">*</span></label>
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Main Factory, Head Office"
            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">Type <span className="text-danger">*</span></label>
          <Select name="worklocations-select-84" value={form.location_type} onChange={e => set('location_type', e.target.value as LocationType)} options={[{ value: "factory", label: "Factory" }, { value: "store", label: "Store" }, { value: "office", label: "Office" }, { value: "remote", label: "Remote" }]} />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">Address</label>
          <input
            value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="Optional address"
            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
        {location && (
          <div className="flex items-center gap-3">
            <label className="text-xs text-fg-muted">Active</label>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-line'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>
        )}
      </form>
    </Drawer>
  );
};

export default WorkLocationsPage;
