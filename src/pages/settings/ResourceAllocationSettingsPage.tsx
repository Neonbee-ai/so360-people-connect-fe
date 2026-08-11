import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '@so360/design-system';
import { PieChart, Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

export interface ResourceAllocationSettingsValue {
  default_allocation_percent: number;
  over_allocation_threshold_percent: number;
  under_utilization_threshold_percent: number;
  auto_warning_limit_percent: number;
  allocation_unit: 'percentage' | 'hours';
}

export const DEFAULT_RESOURCE_ALLOCATION_SETTINGS: ResourceAllocationSettingsValue = {
  default_allocation_percent: 100,
  over_allocation_threshold_percent: 110,
  under_utilization_threshold_percent: 60,
  auto_warning_limit_percent: 120,
  allocation_unit: 'percentage',
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-blue-600';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs text-slate-400">{label}</label>
    {children}
  </div>
);

const ResourceAllocationSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<ResourceAllocationSettingsValue>(DEFAULT_RESOURCE_ALLOCATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<ResourceAllocationSettingsValue>>('resource_allocation_defaults');
      setValue({ ...DEFAULT_RESOURCE_ALLOCATION_SETTINGS, ...(res.value || {}) });
    } catch {
      toast.error('Failed to load resource allocation settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof ResourceAllocationSettingsValue>(field: K, v: ResourceAllocationSettingsValue[K]) =>
    setValue((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('resource_allocation_defaults', value);
      toast.success('Resource allocation settings saved');
    } catch {
      toast.error('Failed to save resource allocation settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading resource allocation settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Resource Allocation Defaults"
        subtitle="Default allocation percentages and warning thresholds used across Allocations"
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
            <PieChart className="w-4 h-4" /> Allocation Defaults
          </h3>

          <Field label="Default Allocation %">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.default_allocation_percent}
              onChange={(e) => set('default_allocation_percent', parseFloat(e.target.value) || 0)}
            />
          </Field>

          <Field label="Allocation Unit">
            <select
              className={INPUT_CLASS}
              value={value.allocation_unit}
              onChange={(e) => set('allocation_unit', e.target.value as ResourceAllocationSettingsValue['allocation_unit'])}
            >
              <option value="percentage">Percentage</option>
              <option value="hours">Hours</option>
            </select>
          </Field>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Thresholds &amp; Warnings</h3>

          <Field label="Over Allocation Threshold %">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.over_allocation_threshold_percent}
              onChange={(e) => set('over_allocation_threshold_percent', parseFloat(e.target.value) || 0)}
            />
          </Field>

          <Field label="Under Utilization Threshold %">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.under_utilization_threshold_percent}
              onChange={(e) => set('under_utilization_threshold_percent', parseFloat(e.target.value) || 0)}
            />
          </Field>

          <Field label="Auto Warning Limit %">
            <input
              type="number"
              className={INPUT_CLASS}
              value={value.auto_warning_limit_percent}
              onChange={(e) => set('auto_warning_limit_percent', parseFloat(e.target.value) || 0)}
            />
          </Field>
        </div>
      </div>
    </div>
  );
};

export default ResourceAllocationSettingsPage;
