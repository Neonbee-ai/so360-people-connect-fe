import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, Plus, Edit2, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { useShellBridge } from '@so360/shell-context';
import { workLocationsApi, WorkLocation, CreateWorkLocationPayload, LocationType } from '../services/workLocationsService';

const LOCATION_TYPE_STYLES: Record<LocationType, { label: string; className: string }> = {
  factory: { label: 'Factory', className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  store: { label: 'Store', className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  office: { label: 'Office', className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' },
  remote: { label: 'Remote', className: 'bg-green-500/10 text-green-400 border border-green-500/20' },
};

const LocationTypeBadge: React.FC<{ type: LocationType }> = ({ type }) => {
  const style = LOCATION_TYPE_STYLES[type] || LOCATION_TYPE_STYLES.office;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
};

const WorkLocationsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded ?? false) && (shell?.isFeatureEnabled?.('action:people:employees:create') ?? true);

  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WorkLocation | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await workLocationsApi.getAll();
      setLocations(result.data);
    } catch {
      setToast({ message: 'Failed to load work locations', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: CreateWorkLocationPayload) => {
    try {
      await workLocationsApi.create(data);
      setShowModal(false);
      setToast({ message: `Work location "${data.name}" created`, type: 'success' });
      load();
    } catch {
      setToast({ message: 'Failed to create work location', type: 'error' });
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateWorkLocationPayload>) => {
    try {
      await workLocationsApi.update(id, data);
      setEditing(null);
      setToast({ message: 'Work location updated', type: 'success' });
      load();
    } catch {
      setToast({ message: 'Failed to update work location', type: 'error' });
    }
  };

  const handleToggleActive = async (loc: WorkLocation) => {
    await handleUpdate(loc.id, { is_active: !loc.is_active });
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await workLocationsApi.delete(id);
      setToast({ message: result.message, type: 'success' });
      load();
    } catch {
      setToast({ message: 'Failed to delete work location', type: 'error' });
    }
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Work Locations"
        subtitle="Define where your people work"
        actions={
          canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Location
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
      ) : locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No work locations"
          description="Add locations like Factory, Store, Office, or Remote to assign to employees."
          action={canManage ? { label: 'Add Location', onClick: () => setShowModal(true) } : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Address</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Active</th>
                {canManage && <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {locations.map(loc => (
                <tr key={loc.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-50">{loc.name}</td>
                  <td className="px-4 py-3">
                    <LocationTypeBadge type={loc.location_type} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">{loc.address || '—'}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <button
                        onClick={() => handleToggleActive(loc)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${loc.is_active ? 'bg-teal-600' : 'bg-slate-700'}`}
                        title={loc.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${loc.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    ) : (
                      <span className={`text-xs ${loc.is_active ? 'text-teal-400' : 'text-slate-500'}`}>
                        {loc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditing(loc)}
                          className="p-1.5 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id)}
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

      <WorkLocationModal
        isOpen={showModal || !!editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        location={editing}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

// =============================================================================
// Work Location Modal
// =============================================================================

interface WorkLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateWorkLocationPayload) => void;
  onUpdate: (id: string, data: Partial<CreateWorkLocationPayload>) => void;
  location: WorkLocation | null;
}

const BLANK: CreateWorkLocationPayload = { name: '', location_type: 'office', address: '', is_active: true };

const WorkLocationModal: React.FC<WorkLocationModalProps> = ({ isOpen, onClose, onCreate, onUpdate, location }) => {
  const [form, setForm] = useState<CreateWorkLocationPayload>(BLANK);

  useEffect(() => {
    if (location) {
      setForm({ name: location.name, location_type: location.location_type, address: location.address || '', is_active: location.is_active });
    } else {
      setForm(BLANK);
    }
  }, [location]);

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={location ? 'Edit Work Location' : 'Add Work Location'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Main Factory, Head Office"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type <span className="text-red-400">*</span></label>
          <select
            value={form.location_type}
            onChange={e => set('location_type', e.target.value as LocationType)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
          >
            <option value="factory">Factory</option>
            <option value="store">Store</option>
            <option value="office">Office</option>
            <option value="remote">Remote</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Address</label>
          <input
            value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="Optional address"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        {location && (
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
            {location ? 'Save Changes' : 'Add Location'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default WorkLocationsPage;
