import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '@so360/design-system';
import { ClipboardCheck, Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

export interface AttendanceSettingsValue {
  late_mark_grace_minutes: number;
  early_exit_grace_minutes: number;
  auto_attendance_enabled: boolean;
  manual_attendance_allowed: boolean;
  missing_punch_policy: string;
  geo_validation_enabled: boolean;
  ip_restriction_list: string;
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettingsValue = {
  late_mark_grace_minutes: 10,
  early_exit_grace_minutes: 10,
  auto_attendance_enabled: false,
  manual_attendance_allowed: true,
  missing_punch_policy: 'Flag for manager review',
  geo_validation_enabled: false,
  ip_restriction_list: '',
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-blue-600';

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
  >
    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
  </button>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs text-slate-400">{label}</label>
    {children}
  </div>
);

const AttendanceSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<AttendanceSettingsValue>(DEFAULT_ATTENDANCE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<AttendanceSettingsValue>>('attendance');
      setValue({ ...DEFAULT_ATTENDANCE_SETTINGS, ...(res.value || {}) });
    } catch {
      toast.error('Failed to load attendance settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof AttendanceSettingsValue>(field: K, v: AttendanceSettingsValue[K]) =>
    setValue((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('attendance', value);
      toast.success('Attendance settings saved');
    } catch {
      toast.error('Failed to save attendance settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading attendance settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Attendance Settings"
        subtitle="Grace periods, punch rules, and location validation"
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
            <ClipboardCheck className="w-4 h-4" /> Punch Rules
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Late Mark Grace (minutes)">
              <input
                type="number"
                className={INPUT_CLASS}
                value={value.late_mark_grace_minutes}
                onChange={(e) => set('late_mark_grace_minutes', parseInt(e.target.value, 10) || 0)}
              />
            </Field>
            <Field label="Early Exit Grace (minutes)">
              <input
                type="number"
                className={INPUT_CLASS}
                value={value.early_exit_grace_minutes}
                onChange={(e) => set('early_exit_grace_minutes', parseInt(e.target.value, 10) || 0)}
              />
            </Field>
          </div>

          <Field label="Missing Punch Policy">
            <input
              type="text"
              className={INPUT_CLASS}
              value={value.missing_punch_policy}
              onChange={(e) => set('missing_punch_policy', e.target.value)}
            />
          </Field>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Marking Methods &amp; Validation</h3>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Auto Attendance (from timesheet/shift)</span>
            <Toggle checked={value.auto_attendance_enabled} onChange={(v) => set('auto_attendance_enabled', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Manual Attendance Allowed</span>
            <Toggle checked={value.manual_attendance_allowed} onChange={(v) => set('manual_attendance_allowed', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Geo Validation</span>
            <Toggle checked={value.geo_validation_enabled} onChange={(v) => set('geo_validation_enabled', v)} />
          </div>

          <Field label="IP Restriction (comma-separated IP/CIDR list)">
            <input
              type="text"
              className={INPUT_CLASS}
              value={value.ip_restriction_list}
              onChange={(e) => set('ip_restriction_list', e.target.value)}
              placeholder="e.g. 192.168.1.0/24, 10.0.0.5"
            />
          </Field>
        </div>
      </div>
    </div>
  );
};

export default AttendanceSettingsPage;
