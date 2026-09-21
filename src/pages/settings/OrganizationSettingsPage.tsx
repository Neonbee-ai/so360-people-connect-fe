import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, toast } from '@so360/design-system';
import { Building2, Save, Globe2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

export interface OrganizationSettingsValue {
  default_working_hours: number;
  work_week_start_day: string;
  work_week_end_day: string;
  weekend_days: string[];
  shift_duration_hours: number;
  office_start_time: string;
  office_end_time: string;
  time_format: '12h' | '24h';
  employee_id_format: string;
  default_joining_status: string;
  probation_period_days: number;
  notice_period_days: number;
  attendance_cutoff_time: string;
}

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettingsValue = {
  default_working_hours: 8,
  work_week_start_day: 'Monday',
  work_week_end_day: 'Friday',
  weekend_days: ['Saturday', 'Sunday'],
  shift_duration_hours: 8,
  office_start_time: '09:00',
  office_end_time: '18:00',
  time_format: '24h',
  employee_id_format: 'EMP-{seq}',
  default_joining_status: 'Probation',
  probation_period_days: 90,
  notice_period_days: 30,
  attendance_cutoff_time: '10:00',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-blue-600';

const OrganizationSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<OrganizationSettingsValue>(DEFAULT_ORGANIZATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<OrganizationSettingsValue>>('organization');
      setValue({ ...DEFAULT_ORGANIZATION_SETTINGS, ...(res.value || {}) });
    } catch {
      toast.error('Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof OrganizationSettingsValue>(field: K, v: OrganizationSettingsValue[K]) =>
    setValue((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('organization', value);
      toast.success('Organization settings saved');
    } catch {
      toast.error('Failed to save organization settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading organization settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Organization Settings"
        subtitle="Working hours, calendar defaults, and organization-wide identifiers"
        actions={
          canManage && (
            <Button variant="primary" onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Working Hours
          </h3>

          <Field label="Default Working Hours (per day)">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.default_working_hours}
              onChange={(e) => set('default_working_hours', parseFloat(e.target.value) || 0)}
            />
          </Field>

          <Field label="Shift Duration (hours)">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.shift_duration_hours}
              onChange={(e) => set('shift_duration_hours', parseFloat(e.target.value) || 0)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Office Start Time">
              <input
                type="time"
                className={INPUT_CLASS}
                value={value.office_start_time}
                onChange={(e) => set('office_start_time', e.target.value)}
              />
            </Field>
            <Field label="Office End Time">
              <input
                type="time"
                className={INPUT_CLASS}
                value={value.office_end_time}
                onChange={(e) => set('office_end_time', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Attendance Cut-off Time">
            <input
              type="time"
              className={INPUT_CLASS}
              value={value.attendance_cutoff_time}
              onChange={(e) => set('attendance_cutoff_time', e.target.value)}
            />
          </Field>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Work Week</h3>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Work Week Start Day">
              <select
                className={INPUT_CLASS}
                value={value.work_week_start_day}
                onChange={(e) => set('work_week_start_day', e.target.value)}
              >
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Work Week End Day">
              <select
                className={INPUT_CLASS}
                value={value.work_week_end_day}
                onChange={(e) => set('work_week_end_day', e.target.value)}
              >
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Weekend Days">
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const selected = value.weekend_days.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() =>
                      set(
                        'weekend_days',
                        selected ? value.weekend_days.filter((x) => x !== d) : [...value.weekend_days, d],
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-blue-600/10 text-blue-400 border-blue-600/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Locale &amp; Formats</h3>

          <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-400">
            <Globe2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" />
            <span>
              Timezone (<span className="text-slate-300">{shell?.businessSettings?.timezone || 'not set'}</span>) and date
              format (<span className="text-slate-300">{shell?.businessSettings?.date_format || 'not set'}</span>) are
              organization-wide and managed once for every module in{' '}
              <Link to="/settings/organization" className="text-blue-400 hover:text-blue-300 underline">
                Business Settings
              </Link>
              , not here.
            </span>
          </div>

          <Field label="Time Format">
            <select
              className={INPUT_CLASS}
              value={value.time_format}
              onChange={(e) => set('time_format', e.target.value as '12h' | '24h')}
            >
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </Field>

          <Field label="Employee ID Format">
            <input
              type="text"
              className={INPUT_CLASS}
              value={value.employee_id_format}
              onChange={(e) => set('employee_id_format', e.target.value)}
              placeholder="e.g. EMP-{seq}"
            />
          </Field>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Joining &amp; Exit</h3>

          <Field label="Default Joining Status">
            <input
              type="text"
              className={INPUT_CLASS}
              value={value.default_joining_status}
              onChange={(e) => set('default_joining_status', e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Probation Period (days)">
              <input
                type="number"
                className={INPUT_CLASS}
                value={value.probation_period_days}
                onChange={(e) => set('probation_period_days', parseInt(e.target.value, 10) || 0)}
              />
            </Field>
            <Field label="Notice Period (days)">
              <input
                type="number"
                className={INPUT_CLASS}
                value={value.notice_period_days}
                onChange={(e) => set('notice_period_days', parseInt(e.target.value, 10) || 0)}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs text-slate-400">{label}</label>
    {children}
  </div>
);

export default OrganizationSettingsPage;
