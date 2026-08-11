import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '@so360/design-system';
import { Gauge, Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

export interface UtilizationSettingsValue {
  default_capacity_hours: number;
  working_hours_per_day: number;
  allocation_threshold_percent: number;
  warning_threshold_percent: number;
  overtime_threshold_percent: number;
}

export const DEFAULT_UTILIZATION_SETTINGS: UtilizationSettingsValue = {
  default_capacity_hours: 40,
  working_hours_per_day: 8,
  allocation_threshold_percent: 100,
  warning_threshold_percent: 90,
  overtime_threshold_percent: 110,
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-blue-600';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs text-slate-400">{label}</label>
    {children}
  </div>
);

const UtilizationSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<UtilizationSettingsValue>(DEFAULT_UTILIZATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<UtilizationSettingsValue>>('utilization_settings');
      setValue({ ...DEFAULT_UTILIZATION_SETTINGS, ...(res.value || {}) });
    } catch {
      toast.error('Failed to load utilization settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof UtilizationSettingsValue>(field: K, v: UtilizationSettingsValue[K]) =>
    setValue((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('utilization_settings', value);
      toast.success('Utilization settings saved');
    } catch {
      toast.error('Failed to save utilization settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading utilization settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Utilization Settings"
        subtitle="Capacity, working hours, and threshold defaults used by the Utilization dashboard"
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
            <Gauge className="w-4 h-4" /> Capacity
          </h3>

          <Field label="Default Capacity (hours/week)">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.default_capacity_hours}
              onChange={(e) => set('default_capacity_hours', parseFloat(e.target.value) || 0)}
            />
          </Field>

          <Field label="Working Hours (per day)">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.working_hours_per_day}
              onChange={(e) => set('working_hours_per_day', parseFloat(e.target.value) || 0)}
            />
          </Field>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Thresholds</h3>

          <Field label="Allocation Threshold %">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.allocation_threshold_percent}
              onChange={(e) => set('allocation_threshold_percent', parseFloat(e.target.value) || 0)}
            />
          </Field>

          <Field label="Warning Threshold %">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.warning_threshold_percent}
              onChange={(e) => set('warning_threshold_percent', parseFloat(e.target.value) || 0)}
            />
          </Field>

          <Field label="Overtime Threshold %">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.overtime_threshold_percent}
              onChange={(e) => set('overtime_threshold_percent', parseFloat(e.target.value) || 0)}
            />
          </Field>
        </div>
      </div>
    </div>
  );
};

export default UtilizationSettingsPage;
