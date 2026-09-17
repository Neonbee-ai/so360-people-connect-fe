import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CalendarDays, Plus, Edit2, Trash2, Copy } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
  holidaysApi,
  Holiday,
  CreateHolidayPayload,
  HolidayType,
  CopyHolidaysResult,
} from '../services/holidaysService';
import { workLocationsApi, WorkLocation } from '../services/workLocationsService';
import { mastersApi, MasterRow } from '../services/mastersService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HOLIDAY_TYPE_OPTIONS: Array<{ value: HolidayType; label: string }> = [
  { value: 'national', label: 'National' },
  { value: 'company', label: 'Company' },
  { value: 'regional', label: 'Regional' },
  { value: 'optional', label: 'Optional' },
  { value: 'custom', label: 'Custom' },
];

const HOLIDAY_TYPE_BADGE: Record<HolidayType, string> = {
  national: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  company: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  regional: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  optional: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  custom: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};

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
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [copying, setCopying] = useState(false);

  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<MasterRow[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await holidaysApi.getAll({
        year,
        holiday_type: typeFilter || undefined,
      });
      setHolidays(result.data);
    } catch {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [year, typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    workLocationsApi.getAll().then(r => setWorkLocations(r.data ?? [])).catch(() => setWorkLocations([]));
    mastersApi.getAll('employment_type').then(r => setEmploymentTypes(r.data ?? [])).catch(() => setEmploymentTypes([]));
  }, []);

  const workLocationName = useCallback(
    (id?: string | null) => workLocations.find(l => l.id === id)?.name,
    [workLocations],
  );
  const employmentTypeName = useCallback(
    (id?: string | null) => employmentTypes.find(m => m.id === id)?.name,
    [employmentTypes],
  );

  const monthGroups = useMemo(() => groupByMonth(holidays), [holidays]);

  const handleCreate = async (data: CreateHolidayPayload) => {
    try {
      await holidaysApi.create(data);
      setShowModal(false);
      toast.success(`Holiday "${data.name}" created`);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create holiday');
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateHolidayPayload>) => {
    try {
      await holidaysApi.update(id, data);
      setEditing(null);
      toast.success('Holiday updated');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update holiday');
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

  const handleCopyPreviousYear = async () => {
    const toYear = Number(year);
    const fromYear = toYear - 1;
    if (!window.confirm(`Copy every holiday from ${fromYear} into ${toYear}?`)) return;
    try {
      setCopying(true);
      const result: CopyHolidaysResult = await holidaysApi.copyPreviousYear(fromYear, toYear);
      if (result.created > 0 && result.skipped > 0) {
        toast.success(`Copied ${result.created} holiday(s), skipped ${result.skipped} duplicate(s)`);
      } else if (result.created > 0) {
        toast.success(`Copied ${result.created} holiday(s) from ${fromYear}`);
      } else {
        toast.error(`Nothing to copy — all ${result.skipped} holiday(s) from ${fromYear} already exist in ${toYear}`);
      }
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to copy holidays');
    } finally {
      setCopying(false);
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
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Types</option>
              {HOLIDAY_TYPE_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
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
                onClick={handleCopyPreviousYear}
                disabled={copying}
                title={`Copy every holiday from ${Number(year) - 1} into ${year}`}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Copy size={16} />
                {copying ? 'Copying…' : 'Copy from Previous Year'}
              </button>
            )}
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
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Scope</th>
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
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${HOLIDAY_TYPE_BADGE[h.holiday_type] || HOLIDAY_TYPE_BADGE.custom}`}>
                            {HOLIDAY_TYPE_OPTIONS.find(t => t.value === h.holiday_type)?.label || h.holiday_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {[
                            h.work_location_id ? workLocationName(h.work_location_id) : null,
                            h.employment_type_master_id ? employmentTypeName(h.employment_type_master_id) : null,
                          ].filter(Boolean).join(' · ') || 'Org-wide'}
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
        workLocations={workLocations}
        employmentTypes={employmentTypes}
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
  workLocations: WorkLocation[];
  employmentTypes: MasterRow[];
}

const BLANK: CreateHolidayPayload = {
  name: '', holiday_date: '', holiday_type: 'national', state: '', country: '', region: '',
  is_optional: false, is_mandatory: true, work_location_id: '', employment_type_master_id: '',
};

const HolidayModal: React.FC<HolidayModalProps> = ({
  isOpen, onClose, onCreate, onUpdate, holiday, workLocations, employmentTypes,
}) => {
  const [form, setForm] = useState<CreateHolidayPayload>(BLANK);

  useEffect(() => {
    if (holiday) {
      setForm({
        name: holiday.name,
        holiday_date: holiday.holiday_date,
        holiday_type: holiday.holiday_type || 'national',
        state: holiday.state || '',
        country: holiday.country || '',
        region: holiday.region || '',
        is_optional: holiday.is_optional,
        is_mandatory: holiday.is_mandatory,
        work_location_id: holiday.work_location_id || '',
        employment_type_master_id: holiday.employment_type_master_id || '',
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
    const payload: CreateHolidayPayload = {
      ...form,
      work_location_id: form.work_location_id || null,
      employment_type_master_id: form.employment_type_master_id || null,
    };
    if (holiday) {
      onUpdate(holiday.id, payload);
    } else {
      onCreate(payload);
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
        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="block text-xs text-slate-400 mb-1">Type <span className="text-red-400">*</span></label>
            <select
              value={form.holiday_type}
              onChange={e => set('holiday_type', e.target.value as HolidayType)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            >
              {HOLIDAY_TYPE_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Work Location</label>
            <select
              value={form.work_location_id || ''}
              onChange={e => set('work_location_id', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Locations</option>
              {workLocations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Employment Type</label>
            <select
              value={form.employment_type_master_id || ''}
              onChange={e => set('employment_type_master_id', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Employment Types</option>
              {employmentTypes.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
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
