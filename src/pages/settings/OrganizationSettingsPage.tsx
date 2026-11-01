import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner, Button, Checkbox, Cluster, FieldGrid, Grid, NumberInput, Select, SettingsCard, SettingsPageTemplate, Spinner, Stack, TextField, toast } from '@so360/design-system';
import { Save } from 'lucide-react';
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

  const saveAction = canManage ? (
    <Button variant="primary" onClick={handleSave} disabled={saving || loading} className="gap-nb-2">
      <Save className="w-4 h-4" />
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  ) : undefined;

  const dayOptions = DAYS.map((d) => ({ value: d, label: d }));

  return (
    <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
      title="Organization Settings"
      description="Working hours, calendar defaults, and organization-wide identifiers"
      primaryAction={saveAction}
    >
      {loading ? (
        <Spinner aria-label="Loading organization settings..." />
      ) : (
        <Grid columns={2} gap="lg">
          <SettingsCard title="Working Hours">
            <Stack gap="default">
              <NumberInput
                name="default_working_hours"
                label="Default Working Hours (per day)"
                value={value.default_working_hours}
                onChange={(n) => set('default_working_hours', n || 0)}
              />
              <NumberInput
                name="shift_duration_hours"
                label="Shift Duration (hours)"
                value={value.shift_duration_hours}
                onChange={(n) => set('shift_duration_hours', n || 0)}
              />
              <FieldGrid columns={2}>
                <TextField
                  name="office_start_time"
                  type="time"
                  label="Office Start Time"
                  value={value.office_start_time}
                  onChange={(e) => set('office_start_time', e.target.value)}
                />
                <TextField
                  name="office_end_time"
                  type="time"
                  label="Office End Time"
                  value={value.office_end_time}
                  onChange={(e) => set('office_end_time', e.target.value)}
                />
              </FieldGrid>
              <TextField
                name="attendance_cutoff_time"
                type="time"
                label="Attendance Cut-off Time"
                value={value.attendance_cutoff_time}
                onChange={(e) => set('attendance_cutoff_time', e.target.value)}
              />
            </Stack>
          </SettingsCard>

          <SettingsCard title="Work Week">
            <Stack gap="default">
              <FieldGrid columns={2}>
                <Select
                  name="work_week_start_day"
                  label="Work Week Start Day"
                  value={value.work_week_start_day}
                  onChange={(e) => set('work_week_start_day', e.target.value)}
                  options={dayOptions}
                />
                <Select
                  name="work_week_end_day"
                  label="Work Week End Day"
                  value={value.work_week_end_day}
                  onChange={(e) => set('work_week_end_day', e.target.value)}
                  options={dayOptions}
                />
              </FieldGrid>
              <Stack gap="tight">
                <span className="text-sm font-medium text-fg">Weekend Days</span>
                <Cluster gap="default">
                  {DAYS.map((d) => {
                    const selected = value.weekend_days.includes(d);
                    return (
                      <Checkbox
                        key={d}
                        name={`weekend_day_${d}`}
                        label={d}
                        checked={selected}
                        onChange={() =>
                          set(
                            'weekend_days',
                            selected ? value.weekend_days.filter((x) => x !== d) : [...value.weekend_days, d],
                          )
                        }
                      />
                    );
                  })}
                </Cluster>
              </Stack>
            </Stack>
          </SettingsCard>

          <SettingsCard title="Locale & Formats">
            <Stack gap="default">
              <Banner variant="info">
                Timezone (<span className="text-fg">{shell?.businessSettings?.timezone || 'not set'}</span>) and date
                format (<span className="text-fg">{shell?.businessSettings?.date_format || 'not set'}</span>) are
                organization-wide and managed once for every module in{' '}
                <Link to="/settings/organization" className="text-primary underline">
                  Business Settings
                </Link>
                , not here.
              </Banner>
              <Select
                name="time_format"
                label="Time Format"
                value={value.time_format}
                onChange={(e) => set('time_format', e.target.value as '12h' | '24h')}
                options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]}
              />
              <TextField
                name="employee_id_format"
                label="Employee ID Format"
                value={value.employee_id_format}
                onChange={(e) => set('employee_id_format', e.target.value)}
                placeholder="e.g. EMP-{seq}"
              />
            </Stack>
          </SettingsCard>

          <SettingsCard title="Joining & Exit">
            <Stack gap="default">
              <TextField
                name="default_joining_status"
                label="Default Joining Status"
                value={value.default_joining_status}
                onChange={(e) => set('default_joining_status', e.target.value)}
              />
              <FieldGrid columns={2}>
                <NumberInput
                  name="probation_period_days"
                  label="Probation Period (days)"
                  value={value.probation_period_days}
                  onChange={(n) => set('probation_period_days', Math.trunc(n ?? 0))}
                />
                <NumberInput
                  name="notice_period_days"
                  label="Notice Period (days)"
                  value={value.notice_period_days}
                  onChange={(n) => set('notice_period_days', Math.trunc(n ?? 0))}
                />
              </FieldGrid>
            </Stack>
          </SettingsCard>
        </Grid>
      )}
    </SettingsPageTemplate>
  );
};

export default OrganizationSettingsPage;
