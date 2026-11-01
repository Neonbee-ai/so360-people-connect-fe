import React, { useCallback, useEffect, useState } from 'react';
import { Button, Grid, NumberInput, SettingsCard, SettingsPageTemplate, Spinner, Stack, toast } from '@so360/design-system';
import { Save } from 'lucide-react';
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

  const num = (field: keyof UtilizationSettingsValue) => (n: number | null) => set(field, n || 0);

  const saveAction = canManage ? (
    <Button variant="primary" onClick={handleSave} disabled={saving || loading} className="gap-nb-2">
      <Save className="w-4 h-4" />
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  ) : undefined;

  return (
    <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
      title="Utilization Settings"
      description="Capacity, working hours, and threshold defaults used by the Utilization dashboard"
      primaryAction={saveAction}
    >
      {loading ? (
        <Spinner aria-label="Loading utilization settings..." />
      ) : (
        <Grid columns={2} gap="lg">
          <SettingsCard title="Capacity">
            <Stack gap="default">
              <NumberInput
                name="default_capacity_hours"
                label="Default Capacity (hours/week)"
                value={value.default_capacity_hours}
                onChange={num('default_capacity_hours')}
              />
              <NumberInput
                name="working_hours_per_day"
                label="Working Hours (per day)"
                value={value.working_hours_per_day}
                onChange={num('working_hours_per_day')}
              />
            </Stack>
          </SettingsCard>

          <SettingsCard title="Thresholds">
            <Stack gap="default">
              <NumberInput
                name="allocation_threshold_percent"
                label="Allocation Threshold %"
                value={value.allocation_threshold_percent}
                onChange={num('allocation_threshold_percent')}
              />
              <NumberInput
                name="warning_threshold_percent"
                label="Warning Threshold %"
                value={value.warning_threshold_percent}
                onChange={num('warning_threshold_percent')}
              />
              <NumberInput
                name="overtime_threshold_percent"
                label="Overtime Threshold %"
                value={value.overtime_threshold_percent}
                onChange={num('overtime_threshold_percent')}
              />
            </Stack>
          </SettingsCard>
        </Grid>
      )}
    </SettingsPageTemplate>
  );
};

export default UtilizationSettingsPage;
