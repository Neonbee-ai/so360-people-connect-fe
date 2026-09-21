import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '@so360/design-system';
import { Bell, Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
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

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-blue-600';

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

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading notification settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Notification Settings"
        subtitle="Channel and trigger preferences for People Connect notifications"
        actions={
          canManage && (
            <Button variant="primary" onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )
        }
      />

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Bell className="w-4 h-4" /> Channels x Triggers
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-2 px-3 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Trigger</th>
                {CHANNELS.map((c) => (
                  <th key={c.key} className="py-2 px-3 text-[11px] text-slate-500 uppercase tracking-widest font-bold text-center">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {NOTIFICATION_TRIGGERS.map((t) => (
                <tr key={t.key}>
                  <td className="py-2.5 px-3 text-sm text-slate-300">{t.label}</td>
                  {CHANNELS.map((c) => (
                    <td key={c.key} className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={value.matrix[t.key]?.[c.key] ?? false}
                        onChange={() => toggleCell(t.key, c.key)}
                        aria-label={`${t.label} via ${c.label}`}
                        className="w-4 h-4 accent-blue-600"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <label className="text-xs text-slate-400">Slack Webhook URL</label>
          <input
            type="text"
            className={INPUT_CLASS}
            value={value.slack_webhook_url}
            onChange={(e) => setValue((p) => ({ ...p, slack_webhook_url: e.target.value }))}
            placeholder="https://hooks.slack.com/services/..."
          />
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <label className="text-xs text-slate-400">Discord / Teams Webhook URL</label>
          <input
            type="text"
            className={INPUT_CLASS}
            value={value.discord_teams_webhook_url}
            onChange={(e) => setValue((p) => ({ ...p, discord_teams_webhook_url: e.target.value }))}
            placeholder="https://discord.com/api/webhooks/..."
          />
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
