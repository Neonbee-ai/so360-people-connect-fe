import { api } from './apiClient';

// Generic, category-agnostic org settings store backed by the
// `GET /settings/:category` / `PUT /settings/:category` endpoints
// (org_settings table on the people-connect backend). Any settings
// sub-page (Organization, Attendance, Numbering, and future ones added
// under the Settings Hub) reads/writes via this one client, keyed by
// category — no need to add a new service module per settings page.
export type SettingsCategory =
  | 'organization'
  | 'attendance'
  | 'numbering'
  | string;

export interface OrgSettingsResponse<T = Record<string, unknown>> {
  category: string;
  value: T;
  updated_by: string | null;
  updated_at: string | null;
}

export const settingsApi = {
  get: async <T = Record<string, unknown>>(category: SettingsCategory): Promise<OrgSettingsResponse<T>> => {
    return api.get<OrgSettingsResponse<T>>(`/settings/${category}`);
  },

  update: async <T = Record<string, unknown>>(category: SettingsCategory, value: T): Promise<OrgSettingsResponse<T>> => {
    return api.put<OrgSettingsResponse<T>>(`/settings/${category}`, { value });
  },
};
