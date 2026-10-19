import React, { useEffect, useState, useCallback } from 'react';
import { Mail, CheckCircle } from 'lucide-react';
import {
  toast, getErrorMessage, Alert, Badge, Button, Cluster, EmptyState, RadioGroup,
  SettingsPageTemplate, Skeleton, Stack,
} from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
  notificationSenderApi,
  type ConnectConnection,
  type HrNotificationSenderState,
} from '../../services/notificationSenderService';

/**
 * Settings → Notification Sender.
 *
 * Lets an HR admin pick which of the org's connected email accounts
 * (connected via the Connect module) sends People Connect's system
 * notification emails — the hr_* family (onboarding overdue, document
 * expiry, birthdays, leave-balance-low, etc), all sent with category:
 * 'people'. Clearing the designation falls back to the platform default
 * sender. People Connect never talks to Connect directly — this page calls
 * pc-be, which forwards to Connect on the caller's own tenant/org/auth
 * context.
 */
const NotificationSenderPage: React.FC = () => {
  const shell = useShellBridge() as any;
  // Fail open while permissions resolve (mirrors OnboardingTemplatesPage),
  // fail closed once loaded.
  const canManage = !shell?.permissionsLoaded
    ? true
    : (shell?.hasPermission?.('org_policy.update') ?? true);

  const [state, setState] = useState<HrNotificationSenderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const result = await notificationSenderApi.get();
      setState(result);
      setSelectedId(result.designatedConnectionId);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load connected email accounts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await notificationSenderApi.set(selectedId);
      setState(result);
      setSelectedId(result.designatedConnectionId);
      toast.success(
        result.designatedConnectionId
          ? 'Notification sender updated'
          : 'Notification sender cleared — using the platform default sender',
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update the notification sender'));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const result = await notificationSenderApi.set(null);
      setState(result);
      setSelectedId(null);
      toast.success('Notification sender cleared — using the platform default sender');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to clear the notification sender'));
    } finally {
      setSaving(false);
    }
  };

  const connections = state?.connections ?? [];
  const hasChanges = state !== null && selectedId !== state.designatedConnectionId;

  const connectionLabel = (conn: ConnectConnection) =>
    conn.display_name || `${conn.piece_name} account`;

  const DEFAULT_VALUE = '';
  const radioOptions = [
    {
      value: DEFAULT_VALUE,
      label: 'Platform default sender',
      description: 'Used when no connected account is designated',
      disabled: !canManage,
    },
    ...connections.map((conn) => ({
      value: conn.id,
      label: connectionLabel(conn),
      description: conn.piece_name,
      disabled: !canManage,
    })),
  ];

  return (
    <SettingsPageTemplate
      title="Notification Sender"
      description="Choose which connected email account sends People Connect's system notification emails"
    >
      <Stack gap="default">
        {loadError && (
          <Alert
            variant="error"
            title="Couldn't load connected email accounts"
            action={{ label: 'Retry', onClick: () => void load() }}
          >
            {loadError}
          </Alert>
        )}

        {loading ? (
          <Stack gap="tight">
            <Skeleton variant="rect" />
            <Skeleton variant="rect" />
          </Stack>
        ) : !loadError && connections.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No connected email accounts"
            description="Connect an email account first (Gmail or Outlook, via the Connect module) before you can designate a sender for People Connect's notification emails. Until then, notifications use the platform default sender."
            action={{ label: 'Go to Connect', onClick: () => { window.location.href = '/connect'; } }}
          />
        ) : !loadError ? (
          <Stack gap="default">
            <RadioGroup
              name="notification-sender"
              label="Notification sender"
              options={radioOptions}
              value={selectedId ?? DEFAULT_VALUE}
              onChange={(v) => setSelectedId(v === DEFAULT_VALUE ? null : v)}
            />

            <Cluster gap="tight">
              {state?.designatedConnectionId === null && (
                <Badge tone="primary">
                  <CheckCircle size={12} /> Using platform default sender
                </Badge>
              )}
              {connections.some((conn) => conn.designated_purpose === 'people') && (
                <Badge tone="primary">
                  <CheckCircle size={12} /> Currently designated
                </Badge>
              )}
            </Cluster>

            {canManage && (
              <Cluster gap="default">
                <Button variant="primary" onClick={handleSave} disabled={saving || !hasChanges}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="ghost" onClick={handleClear} disabled={saving || !state?.designatedConnectionId}>
                  Clear (use platform default)
                </Button>
              </Cluster>
            )}
          </Stack>
        ) : null}
      </Stack>
    </SettingsPageTemplate>
  );
};

export default NotificationSenderPage;
