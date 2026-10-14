import React, { useEffect, useState, useCallback } from 'react';
import { Mail, CheckCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { toast, getErrorMessage, Alert } from '@so360/design-system';
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

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Notification Sender"
        subtitle="Choose which connected email account sends People Connect's system notification emails"
      />

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
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-nb bg-surface-raised/50" />
          <div className="h-16 animate-pulse rounded-nb bg-surface-raised/50" />
        </div>
      ) : !loadError && connections.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No connected email accounts"
          description="Connect an email account first (Gmail or Outlook, via the Connect module) before you can designate a sender for People Connect's notification emails. Until then, notifications use the platform default sender."
          action={{ label: 'Go to Connect', onClick: () => { window.location.href = '/connect'; } }}
        />
      ) : !loadError ? (
        <div className="space-y-4">
          <div className="rounded-nb border border-line-strong divide-y divide-line overflow-hidden">
            <label
              className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${
                selectedId === null ? 'bg-primary/10' : 'hover:bg-surface-raised/60'
              } ${!canManage ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <input
                type="radio"
                name="notification-sender"
                checked={selectedId === null}
                onChange={() => setSelectedId(null)}
                disabled={!canManage}
                className="text-primary"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-fg">Platform default sender</p>
                <p className="text-xs text-fg-subtle">
                  Used when no connected account is designated
                </p>
              </div>
              {state?.designatedConnectionId === null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-nb-sm text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <CheckCircle size={12} /> Using platform default sender
                </span>
              )}
            </label>

            {connections.map(conn => (
              <label
                key={conn.id}
                className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${
                  selectedId === conn.id ? 'bg-primary/10' : 'hover:bg-surface-raised/60'
                } ${!canManage ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <input
                  type="radio"
                  name="notification-sender"
                  checked={selectedId === conn.id}
                  onChange={() => setSelectedId(conn.id)}
                  disabled={!canManage}
                  className="text-primary"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-fg">{connectionLabel(conn)}</p>
                  <p className="text-xs text-fg-subtle capitalize">{conn.piece_name}</p>
                </div>
                {conn.designated_purpose === 'people' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-nb-sm text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    <CheckCircle size={12} /> Currently designated
                  </span>
                )}
              </label>
            ))}
          </div>

          {canManage && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={handleClear}
                disabled={saving || !state?.designatedConnectionId}
                className="px-4 py-2 text-sm text-fg-muted hover:text-fg disabled:opacity-50 transition-colors"
              >
                Clear (use platform default)
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationSenderPage;
