import React, { useCallback, useEffect, useState } from 'react';
import { Button, Grid, NumberInput, Select, SettingsCard, SettingsPageTemplate, Spinner, Stack, Switch, toast } from '@so360/design-system';
import { Save } from 'lucide-react';
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

  const saveAction = canManage ? (
    <Button variant="primary" onClick={handleSave} disabled={saving || loading} className="gap-nb-2">
      <Save className="w-4 h-4" />
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  ) : undefined;

  return (
    <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
      title="Timesheet Settings"
      description="Submission requirements, reminders, and lock/edit windows for the Timesheet module"
      primaryAction={saveAction}
    >
      {loading ? (
        <Spinner aria-label="Loading timesheet settings..." />
      ) : (
        <Grid columns={2} gap="lg">
          <SettingsCard title="Submission Rules">
            <Stack gap="default">
              <Switch
                name="daily_submission_required"
                label="Daily Submission Required"
                checked={value.daily_submission_required}
                onCheckedChange={(v) => set('daily_submission_required', v)}
              />
              <Switch
                name="weekly_submission_required"
                label="Weekly Submission Required"
                checked={value.weekly_submission_required}
                onCheckedChange={(v) => set('weekly_submission_required', v)}
              />
              <Select
                name="reminder_frequency"
                label="Reminder Frequency"
                value={value.reminder_frequency}
                onChange={(e) => set('reminder_frequency', e.target.value as TimesheetSettingsValue['reminder_frequency'])}
                options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'none', label: 'None' }]}
              />
            </Stack>
          </SettingsCard>

          <SettingsCard title="Windows & Approval">
            <Stack gap="default">
              <Grid columns={2} gap="md">
                <NumberInput
                  name="lock_period_days"
                  label="Lock Period (days)"
                  value={value.lock_period_days}
                  onChange={(n) => set('lock_period_days', Math.trunc(n ?? 0))}
                />
                <NumberInput
                  name="edit_window_days"
                  label="Edit Window (days)"
                  value={value.edit_window_days}
                  onChange={(n) => set('edit_window_days', Math.trunc(n ?? 0))}
                />
              </Grid>
              <Select
                name="approval_rules"
                label="Approval Rules"
                value={value.approval_rules}
                onChange={(e) => set('approval_rules', e.target.value as TimesheetSettingsValue['approval_rules'])}
                options={[{ value: 'manager', label: 'Direct Manager' }, { value: 'approval_chain', label: 'Approval Chain' }, { value: 'auto_approve', label: 'Auto-Approve' }]}
              />
            </Stack>
          </SettingsCard>
        </Grid>
      )}
    </SettingsPageTemplate>
  );
};

export default TimesheetSettingsPage;
