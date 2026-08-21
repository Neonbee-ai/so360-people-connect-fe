import { api } from './apiClient';

// =============================================================================
// HR Notification Sender — mirrors pc-be src/modules/integrations
// (proxies so360-connect-be's connections/designation API, purpose='people')
// =============================================================================

/**
 * A connected email/comms account, as forwarded from so360-connect-be.
 * piece_name is the connector identity (e.g. "gmail", "microsoft-outlook") —
 * connect-be stores no separate email/provider label.
 */
export interface ConnectConnection {
  id: string;
  piece_name: string;
  display_name?: string | null;
  status?: string | null;
  /** Non-null when this connection currently holds a purpose designation. */
  designated_purpose: string | null;
}

export interface HrNotificationSenderState {
  connections: ConnectConnection[];
  /** The connection currently designated as the People Connect email sender, or null (platform default). */
  designatedConnectionId: string | null;
}

export const notificationSenderApi = {
  /**
   * List the org's connected email accounts and which one, if any, sends
   * People Connect's hr_* notification emails (category: people).
   */
  get: async (): Promise<HrNotificationSenderState> => {
    return api.get<HrNotificationSenderState>('/integrations/hr-notification-sender');
  },

  /**
   * Designate a connection as the sender, or pass null to clear the
   * designation and fall back to the platform default sender.
   */
  set: async (connectionId: string | null): Promise<HrNotificationSenderState> => {
    return api.patch<HrNotificationSenderState>('/integrations/hr-notification-sender', {
      connection_id: connectionId,
    });
  },
};
