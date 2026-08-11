import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CalendarDays, Plus, Edit2, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { holidaysApi, Holiday, CreateHolidayPayload } from '../services/holidaysService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

const groupByMonth = (holidays: Holiday[]): Array<{ month: string; items: Holiday[] }> => {
  const groups = new Map<number, Holiday[]>();
  holidays.forEach(h => {
    const monthIdx = new Date(h.holiday_date).getMonth();
    const list = groups.get(monthIdx) ?? [];
    list.push(h);
    groups.set(monthIdx, list);
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([monthIdx, items]) => ({
      month: MONTH_NAMES[monthIdx],
      items: [...items].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)),
    }));
};

const HolidaysPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:holidays:create') ?? true);

  const [year, setYear] = useState<string>(String(currentYear));
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await holidaysApi.getAll({ year });
      setHolidays(result.data);
    } catch {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const monthGroups = useMemo(() => groupByMonth(holidays), [holidays]);

  const handleCreate = async (data: CreateHolidayPayload) => {
    try {
      await holidaysApi.create(data);
      setShowModal(false);
      toast.success(`Holiday "${data.name}" created`);
      load();
    } catch {
      toast.error('Failed to create holiday');
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateHolidayPayload>) => {
    try {
      await holidaysApi.update(id, data);
      setEditing(null);
      toast.success('Holiday updated');
      load();
    } catch {
      toast.error('Failed to update holiday');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await holidaysApi.delete(id);
      toast.success(result.message);
      load();
    } catch {
      toast.error('Failed to delete holiday');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Holiday Calendar"
        subtitle="Manage the organization's holiday list by year"
        actions={
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {canManage && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Holiday
              </button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : holidays.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No holidays"
          description={`No holidays configured for ${year}. Add public and optional holidays for your organization.`}
          action={canManage ? { label: 'Add Holiday', onClick: () => setShowModal(true) } : undefined}
        />
      ) : (
        <div className="space-y-6">
          {monthGroups.map(group => (
            <div key={group.month}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.month}</h3>
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                      {canManage && <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {group.items.map(h => (
                      <tr key={h.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-slate-300">{h.holiday_date}</td>
                        <td className="px-4 py-3 font-medium text-slate-50">{h.name}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {[h.region, h.state, h.country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${h.is_optional ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'}`}>
                            {h.is_optional ? 'Optional' : 'Mandatory'}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditing(h)}
                                className="p-1.5 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(h.id)}
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
            </div>
          ))}
        </div>
      )}

      <HolidayModal
        isOpen={showModal || !!editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        holiday={editing}
      />
    </div>
  );
};

// =============================================================================
// Holiday Modal
// =============================================================================

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateHolidayPayload) => void;
  onUpdate: (id: string, data: Partial<CreateHolidayPayload>) => void;
  holiday: Holiday | null;
}

const BLANK: CreateHolidayPayload = {
  name: '', holiday_date: '', state: '', country: '', region: '', is_optional: false, is_mandatory: true,
};

const HolidayModal: React.FC<HolidayModalProps> = ({ isOpen, onClose, onCreate, onUpdate, holiday }) => {
  const [form, setForm] = useState<CreateHolidayPayload>(BLANK);

  useEffect(() => {
    if (holiday) {
      setForm({
        name: holiday.name,
        holiday_date: holiday.holiday_date,
        state: holiday.state || '',
        country: holiday.country || '',
        region: holiday.region || '',
        is_optional: holiday.is_optional,
        is_mandatory: holiday.is_mandatory,
      });
    } else {
      setForm(BLANK);
    }
  }, [holiday]);

  const set = (field: keyof CreateHolidayPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.holiday_date) return;
    if (holiday) {
      onUpdate(holiday.id, form);
    } else {
      onCreate(form);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={holiday ? 'Edit Holiday' : 'Add Holiday'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Republic Day"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Date <span className="text-red-400">*</span></label>
          <input
            required
            type="date"
            value={form.holiday_date}
            onChange={e => set('holiday_date', e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Region</label>
            <input
              value={form.region}
              onChange={e => set('region', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">State</label>
            <input
              value={form.state}
              onChange={e => set('state', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Country</label>
            <input
              value={form.country}
              onChange={e => set('country', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400">Optional holiday</label>
          <button
            type="button"
            onClick={() => set('is_optional', !form.is_optional)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_optional ? 'bg-teal-600' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${form.is_optional ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
            {holiday ? 'Save Changes' : 'Add Holiday'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default HolidaysPage;
