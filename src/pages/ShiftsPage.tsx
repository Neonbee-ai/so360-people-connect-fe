import React, { useEffect, useState, useCallback } from 'react';
import { Clock, Plus, Edit2, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { shiftsApi, Shift, CreateShiftPayload } from '../services/shiftsService';

const ShiftsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:shifts:create') ?? true);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await shiftsApi.getAll();
      setShifts(result.data);
    } catch {
      toast.error('Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: CreateShiftPayload) => {
    try {
      await shiftsApi.create(data);
      setShowModal(false);
      toast.success(`Shift "${data.name}" created`);
      load();
    } catch {
      toast.error('Failed to create shift');
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateShiftPayload>) => {
    try {
      await shiftsApi.update(id, data);
      setEditing(null);
      toast.success('Shift updated');
      load();
    } catch {
      toast.error('Failed to update shift');
    }
  };

  const handleToggleActive = async (shift: Shift) => {
    await handleUpdate(shift.id, { is_active: !shift.is_active });
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await shiftsApi.delete(id);
      toast.success(result.message);
      load();
    } catch {
      toast.error('Failed to delete shift');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Shift Management"
        subtitle="Define work shifts, grace periods, and weekly offs"
        actions={
          canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Shift
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
      ) : shifts.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No shifts"
          description="Add shifts like Morning, Evening, or Night with grace periods and break durations."
          action={canManage ? { label: 'Add Shift', onClick: () => setShowModal(true) } : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Timing</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Grace</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Break</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Active</th>
                {canManage && <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {shifts.map(shift => (
                <tr key={shift.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-50">
                    {shift.name}
                    {shift.is_night_shift && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Night
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{shift.start_time} – {shift.end_time}</td>
                  <td className="px-4 py-3 text-slate-400">{shift.grace_period_minutes} min</td>
                  <td className="px-4 py-3 text-slate-400">{shift.break_duration_minutes} min</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <button
                        onClick={() => handleToggleActive(shift)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${shift.is_active ? 'bg-teal-600' : 'bg-slate-700'}`}
                        title={shift.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${shift.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    ) : (
                      <span className={`text-xs ${shift.is_active ? 'text-teal-400' : 'text-slate-500'}`}>
                        {shift.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditing(shift)}
                          className="p-1.5 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(shift.id)}
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

      <ShiftModal
        isOpen={showModal || !!editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        shift={editing}
      />
    </div>
  );
};

// =============================================================================
// Shift Modal
// =============================================================================

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateShiftPayload) => void;
  onUpdate: (id: string, data: Partial<CreateShiftPayload>) => void;
  shift: Shift | null;
}

const BLANK: CreateShiftPayload = {
  name: '', start_time: '09:00', end_time: '18:00', grace_period_minutes: 0, break_duration_minutes: 0, is_night_shift: false, is_active: true,
};

const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose, onCreate, onUpdate, shift }) => {
  const [form, setForm] = useState<CreateShiftPayload>(BLANK);

  useEffect(() => {
    if (shift) {
      setForm({
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        grace_period_minutes: shift.grace_period_minutes,
        break_duration_minutes: shift.break_duration_minutes,
        is_night_shift: shift.is_night_shift,
        is_active: shift.is_active,
      });
    } else {
      setForm(BLANK);
    }
  }, [shift]);

  const set = (field: keyof CreateShiftPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.start_time || !form.end_time) return;
    if (shift) {
      onUpdate(shift.id, form);
    } else {
      onCreate(form);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={shift ? 'Edit Shift' : 'Add Shift'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Morning Shift"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Start Time <span className="text-red-400">*</span></label>
            <input
              required
              type="time"
              value={form.start_time}
              onChange={e => set('start_time', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">End Time <span className="text-red-400">*</span></label>
            <input
              required
              type="time"
              value={form.end_time}
              onChange={e => set('end_time', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Grace Period (min)</label>
            <input
              type="number"
              min={0}
              value={form.grace_period_minutes}
              onChange={e => set('grace_period_minutes', Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Break Duration (min)</label>
            <input
              type="number"
              min={0}
              value={form.break_duration_minutes}
              onChange={e => set('break_duration_minutes', Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400">Night shift</label>
          <button
            type="button"
            onClick={() => set('is_night_shift', !form.is_night_shift)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_night_shift ? 'bg-teal-600' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${form.is_night_shift ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
        {shift && (
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
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
            {shift ? 'Save Changes' : 'Add Shift'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ShiftsPage;
