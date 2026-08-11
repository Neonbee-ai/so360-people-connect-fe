import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '@so360/design-system';
import { Clock, Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

export interface TimesheetSettingsValue {
  daily_submission_required: boolean;
  weekly_submission_required: boolean;
  reminder_frequency: 'daily' | 'weekly' | 'none';
  lock_period_days: number;
  edit_window_days: number;
  approval_rules: 'manager' | 'approval_chain' | 'auto_approve';
}

export const DEFAULT_TIMESHEET_SETTINGS: TimesheetSettingsValue = {
  daily_submission_required: false,
  weekly_submission_required: true,
  reminder_frequency: 'weekly',
  lock_period_days: 7,
  edit_window_days: 3,
  approval_rules: 'manager',
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

const TimesheetSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<TimesheetSettingsValue>(DEFAULT_TIMESHEET_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<TimesheetSettingsValue>>('timesheet_settings');
      setValue({ ...DEFAULT_TIMESHEET_SETTINGS, ...(res.value || {}) });
    } catch {
      toast.error('Failed to load timesheet settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof TimesheetSettingsValue>(field: K, v: TimesheetSettingsValue[K]) =>
    setValue((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('timesheet_settings', value);
      toast.success('Timesheet settings saved');
    } catch {
      toast.error('Failed to save timesheet settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading timesheet settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Timesheet Settings"
        subtitle="Submission requirements, reminders, and lock/edit windows for the Timesheet module"
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
            <Clock className="w-4 h-4" /> Submission Rules
          </h3>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Daily Submission Required</span>
            <Toggle checked={value.daily_submission_required} onChange={(v) => set('daily_submission_required', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Weekly Submission Required</span>
            <Toggle checked={value.weekly_submission_required} onChange={(v) => set('weekly_submission_required', v)} />
          </div>

          <Field label="Reminder Frequency">
            <select
              className={INPUT_CLASS}
              value={value.reminder_frequency}
              onChange={(e) => set('reminder_frequency', e.target.value as TimesheetSettingsValue['reminder_frequency'])}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="none">None</option>
            </select>
          </Field>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Windows &amp; Approval</h3>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Lock Period (days)">
              <input
                type="number"
                className={INPUT_CLASS}
                value={value.lock_period_days}
                onChange={(e) => set('lock_period_days', parseInt(e.target.value, 10) || 0)}
              />
            </Field>
            <Field label="Edit Window (days)">
              <input
                type="number"
                className={INPUT_CLASS}
                value={value.edit_window_days}
                onChange={(e) => set('edit_window_days', parseInt(e.target.value, 10) || 0)}
              />
            </Field>
          </div>

          <Field label="Approval Rules">
            <select
              className={INPUT_CLASS}
              value={value.approval_rules}
              onChange={(e) => set('approval_rules', e.target.value as TimesheetSettingsValue['approval_rules'])}
            >
              <option value="manager">Direct Manager</option>
              <option value="approval_chain">Approval Chain</option>
              <option value="auto_approve">Auto-Approve</option>
            </select>
          </Field>
        </div>
      </div>
    </div>
  );
};

export default TimesheetSettingsPage;
