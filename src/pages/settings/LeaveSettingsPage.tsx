import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '@so360/design-system';
import { CalendarRange, Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

export interface LeaveSettingsValue {
  leave_year_start_month: string;
  weekend_policy: 'exclude' | 'include';
  holiday_inclusion: boolean;
  sandwich_rule: boolean;
  half_day_rule: 'first_half' | 'second_half' | 'both';
  leave_accrual: 'monthly' | 'yearly' | 'none';
  auto_expiry: boolean;
  auto_carry_forward: boolean;
}

export const DEFAULT_LEAVE_SETTINGS: LeaveSettingsValue = {
  leave_year_start_month: 'January',
  weekend_policy: 'exclude',
  holiday_inclusion: false,
  sandwich_rule: false,
  half_day_rule: 'both',
  leave_accrual: 'monthly',
  auto_expiry: false,
  auto_carry_forward: false,
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

const LeaveSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<LeaveSettingsValue>(DEFAULT_LEAVE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<LeaveSettingsValue>>('leave_policy');
      setValue({ ...DEFAULT_LEAVE_SETTINGS, ...(res.value || {}) });
    } catch {
      toast.error('Failed to load leave settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof LeaveSettingsValue>(field: K, v: LeaveSettingsValue[K]) =>
    setValue((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('leave_policy', value);
      toast.success('Leave settings saved');
    } catch {
      toast.error('Failed to save leave settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading leave settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Leave Policy"
        subtitle="Leave year, accrual, and calendar rules applied across leave requests"
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
            <CalendarRange className="w-4 h-4" /> Leave Calendar
          </h3>

          <Field label="Leave Year Start Month">
            <select
              className={INPUT_CLASS}
              value={value.leave_year_start_month}
              onChange={(e) => set('leave_year_start_month', e.target.value)}
            >
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>

          <Field label="Weekend Policy">
            <select
              className={INPUT_CLASS}
              value={value.weekend_policy}
              onChange={(e) => set('weekend_policy', e.target.value as LeaveSettingsValue['weekend_policy'])}
            >
              <option value="exclude">Exclude weekends from leave count</option>
              <option value="include">Include weekends in leave count</option>
            </select>
          </Field>

          <Field label="Half Day Rule">
            <select
              className={INPUT_CLASS}
              value={value.half_day_rule}
              onChange={(e) => set('half_day_rule', e.target.value as LeaveSettingsValue['half_day_rule'])}
            >
              <option value="first_half">First half only</option>
              <option value="second_half">Second half only</option>
              <option value="both">Both halves allowed</option>
            </select>
          </Field>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Accrual &amp; Rules</h3>

          <Field label="Leave Accrual">
            <select
              className={INPUT_CLASS}
              value={value.leave_accrual}
              onChange={(e) => set('leave_accrual', e.target.value as LeaveSettingsValue['leave_accrual'])}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="none">None</option>
            </select>
          </Field>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Holiday Inclusion (count holidays within a leave span)</span>
            <Toggle checked={value.holiday_inclusion} onChange={(v) => set('holiday_inclusion', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Sandwich Rule</span>
            <Toggle checked={value.sandwich_rule} onChange={(v) => set('sandwich_rule', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Auto Expiry of Unused Leave</span>
            <Toggle checked={value.auto_expiry} onChange={(v) => set('auto_expiry', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Auto Carry Forward to Next Leave Year</span>
            <Toggle checked={value.auto_carry_forward} onChange={(v) => set('auto_carry_forward', v)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveSettingsPage;
