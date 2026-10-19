import React, { useCallback, useEffect, useState } from 'react';
import { Button, Grid, NumberInput, SettingsCard, SettingsPageTemplate, Spinner, Stack, Switch, TextField, toast } from '@so360/design-system';
import { Save } from 'lucide-react';
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

  const saveAction = canManage ? (
    <Button variant="primary" onClick={handleSave} disabled={saving || loading} className="gap-nb-2">
      <Save className="w-4 h-4" />
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  ) : undefined;

  return (
    <SettingsPageTemplate
      title="Attendance Settings"
      description="Grace periods, punch rules, and location validation"
      primaryAction={saveAction}
    >
      {loading ? (
        <Spinner aria-label="Loading attendance settings..." />
      ) : (
        <Grid columns={2} gap="lg">
          <SettingsCard title="Punch Rules">
            <Stack gap="default">
              <Grid columns={2} gap="md">
                <NumberInput
                  name="late_mark_grace_minutes"
                  label="Late Mark Grace (minutes)"
                  value={value.late_mark_grace_minutes}
                  onChange={(n) => set('late_mark_grace_minutes', Math.trunc(n ?? 0))}
                />
                <NumberInput
                  name="early_exit_grace_minutes"
                  label="Early Exit Grace (minutes)"
                  value={value.early_exit_grace_minutes}
                  onChange={(n) => set('early_exit_grace_minutes', Math.trunc(n ?? 0))}
                />
              </Grid>
              <TextField
                name="missing_punch_policy"
                label="Missing Punch Policy"
                value={value.missing_punch_policy}
                onChange={(e) => set('missing_punch_policy', e.target.value)}
              />
            </Stack>
          </SettingsCard>

          <SettingsCard title="Marking Methods & Validation">
            <Stack gap="default">
              <Switch
                name="auto_attendance_enabled"
                label="Auto Attendance (from timesheet/shift)"
                checked={value.auto_attendance_enabled}
                onCheckedChange={(v) => set('auto_attendance_enabled', v)}
              />
              <Switch
                name="manual_attendance_allowed"
                label="Manual Attendance Allowed"
                checked={value.manual_attendance_allowed}
                onCheckedChange={(v) => set('manual_attendance_allowed', v)}
              />
              <Switch
                name="geo_validation_enabled"
                label="Geo Validation"
                checked={value.geo_validation_enabled}
                onCheckedChange={(v) => set('geo_validation_enabled', v)}
              />
              <TextField
                name="ip_restriction_list"
                label="IP Restriction (comma-separated IP/CIDR list)"
                value={value.ip_restriction_list}
                onChange={(e) => set('ip_restriction_list', e.target.value)}
                placeholder="e.g. 192.168.1.0/24, 10.0.0.5"
              />
            </Stack>
          </SettingsCard>
        </Grid>
      )}
    </SettingsPageTemplate>
  );
};

export default AttendanceSettingsPage;
