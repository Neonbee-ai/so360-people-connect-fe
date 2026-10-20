import React, { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, DataTable, Grid, SettingsCard, SettingsPageTemplate, Spinner, Stack, TextField, toast } from '@so360/design-system';
import { Save } from 'lucide-react';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

export const NOTIFICATION_TRIGGERS = [
  { key: 'leave_request', label: 'Leave Request' },
  { key: 'approval', label: 'Approval' },
  { key: 'rejection', label: 'Rejection' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'anniversary', label: 'Anniversary' },
  { key: 'missing_timesheet', label: 'Missing Timesheet' },
  { key: 'utilization_alerts', label: 'Utilization Alerts' },
] as const;

export type NotificationTriggerKey = typeof NOTIFICATION_TRIGGERS[number]['key'];

export interface NotificationChannelMatrix {
  email: boolean;
  sms: boolean;
  push: boolean;
  slack: boolean;
  discord_teams: boolean;
}

export interface NotificationSettingsValue {
  matrix: Record<NotificationTriggerKey, NotificationChannelMatrix>;
  slack_webhook_url: string;
  discord_teams_webhook_url: string;
}

const emptyMatrixRow = (): NotificationChannelMatrix => ({
  email: true,
  sms: false,
  push: true,
  slack: false,
  discord_teams: false,
});

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsValue = {
  matrix: NOTIFICATION_TRIGGERS.reduce((acc, t) => {
    acc[t.key] = emptyMatrixRow();
    return acc;
  }, {} as Record<NotificationTriggerKey, NotificationChannelMatrix>),
  slack_webhook_url: '',
  discord_teams_webhook_url: '',
};

const CHANNELS: { key: keyof NotificationChannelMatrix; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'push', label: 'Push' },
  { key: 'slack', label: 'Slack' },
  { key: 'discord_teams', label: 'Discord/Teams' },
];

const NotificationSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<NotificationSettingsValue>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<NotificationSettingsValue>>('notification_settings');
      const remoteMatrix = res.value?.matrix || {};
      setValue({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(res.value || {}),
        matrix: {
          ...DEFAULT_NOTIFICATION_SETTINGS.matrix,
          ...remoteMatrix,
        },
      });
    } catch {
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleCell = (trigger: NotificationTriggerKey, channel: keyof NotificationChannelMatrix) => {
    setValue((prev) => ({
      ...prev,
      matrix: {
        ...prev.matrix,
        [trigger]: {
          ...prev.matrix[trigger],
          [channel]: !prev.matrix[trigger][channel],
        },
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('notification_settings', value);
      toast.success('Notification settings saved');
    } catch {
      toast.error('Failed to save notification settings');
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

  type TriggerRow = (typeof NOTIFICATION_TRIGGERS)[number];
  const columns = [
    { key: 'trigger', header: 'Trigger', render: (t: TriggerRow) => t.label },
    ...CHANNELS.map((c) => ({
      key: c.key,
      header: c.label,
      align: 'center' as const,
      render: (t: TriggerRow) => (
        <Checkbox
          name={`${t.key}-${c.key}`}
          label={`${t.label} via ${c.label}`}
          hideLabel
          checked={value.matrix[t.key]?.[c.key] ?? false}
          onChange={() => toggleCell(t.key, c.key)}
        />
      ),
    })),
  ];

  return (
    <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
      title="Notification Settings"
      description="Channel and trigger preferences for People Connect notifications"
      primaryAction={saveAction}
    >
      {loading ? (
        <Spinner aria-label="Loading notification settings..." />
      ) : (
        <Stack gap="region">
          <SettingsCard title="Channels x Triggers">
            <DataTable columns={columns} rows={[...NOTIFICATION_TRIGGERS]} rowKey={(t: TriggerRow) => t.key} />
          </SettingsCard>
          <Grid columns={2} gap="lg">
            <SettingsCard title="Slack Webhook URL">
              <TextField
                name="slack_webhook_url"
                label="Slack Webhook URL"
                value={value.slack_webhook_url}
                onChange={(e) => setValue((p) => ({ ...p, slack_webhook_url: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
              />
            </SettingsCard>
            <SettingsCard title="Discord / Teams Webhook URL">
              <TextField
                name="discord_teams_webhook_url"
                label="Discord / Teams Webhook URL"
                value={value.discord_teams_webhook_url}
                onChange={(e) => setValue((p) => ({ ...p, discord_teams_webhook_url: e.target.value }))}
                placeholder="https://discord.com/api/webhooks/..."
              />
            </SettingsCard>
          </Grid>
        </Stack>
      )}
    </SettingsPageTemplate>
  );
};

export default NotificationSettingsPage;
