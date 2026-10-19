import React, { useCallback, useEffect, useState } from 'react';
import { Button, Grid, NumberInput, Select, SettingsCard, SettingsPageTemplate, Spinner, Stack, toast } from '@so360/design-system';
import { Save } from 'lucide-react';
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

  const num = (field: keyof ResourceAllocationSettingsValue) => (n: number | null) =>
    set(field, (n || 0) as never);

  const saveAction = canManage ? (
    <Button variant="primary" onClick={handleSave} disabled={saving || loading} className="gap-nb-2">
      <Save className="w-4 h-4" />
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  ) : undefined;

  return (
    <SettingsPageTemplate
      title="Resource Allocation Defaults"
      description="Default allocation percentages and warning thresholds used across Allocations"
      primaryAction={saveAction}
    >
      {loading ? (
        <Spinner aria-label="Loading resource allocation settings..." />
      ) : (
        <Grid columns={2} gap="lg">
          <SettingsCard title="Allocation Defaults">
            <Stack gap="default">
              <NumberInput
                name="default_allocation_percent"
                label="Default Allocation %"
                value={value.default_allocation_percent}
                onChange={num('default_allocation_percent')}
              />
              <Select
                name="allocation_unit"
                label="Allocation Unit"
                value={value.allocation_unit}
                onChange={(e) => set('allocation_unit', e.target.value as ResourceAllocationSettingsValue['allocation_unit'])}
                options={[{ value: 'percentage', label: 'Percentage' }, { value: 'hours', label: 'Hours' }]}
              />
            </Stack>
          </SettingsCard>

          <SettingsCard title="Thresholds & Warnings">
            <Stack gap="default">
              <NumberInput
                name="over_allocation_threshold_percent"
                label="Over Allocation Threshold %"
                value={value.over_allocation_threshold_percent}
                onChange={num('over_allocation_threshold_percent')}
              />
              <NumberInput
                name="under_utilization_threshold_percent"
                label="Under Utilization Threshold %"
                value={value.under_utilization_threshold_percent}
                onChange={num('under_utilization_threshold_percent')}
              />
              <NumberInput
                name="auto_warning_limit_percent"
                label="Auto Warning Limit %"
                value={value.auto_warning_limit_percent}
                onChange={num('auto_warning_limit_percent')}
              />
            </Stack>
          </SettingsCard>
        </Grid>
      )}
    </SettingsPageTemplate>
  );
};

export default ResourceAllocationSettingsPage;
