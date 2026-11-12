import { api } from './apiClient';

// Company events (town halls, trainings, celebrations) — NOT the /events
// activity log. Backed by people-connect-be /company-events (Pulse 59ea1731).
// Permission rules are enforced server-side; the per-row can_* flags and the
// top-level `permissions` block only drive which buttons the page shows.

export type CompanyEventType = 'meeting' | 'town_hall' | 'training' | 'celebration' | 'social' | 'other';
export type CompanyEventAudience = 'everyone' | 'department' | 'people';
export type CompanyEventStatus = 'scheduled' | 'cancelled';
export type RsvpResponse = 'going' | 'maybe' | 'declined';

export interface RsvpSummary {
  going: number;
  maybe: number;
  declined: number;
  my_response: RsvpResponse | null;
}

export interface CompanyEvent {
  id: string;
  title: string;
  description?: string | null;
  event_type: CompanyEventType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  timezone?: string | null;
  location?: string | null;
  meeting_url?: string | null;
  audience_type: CompanyEventAudience;
  audience_department_ids: string[];
  audience_person_ids: string[];
  rsvp_enabled: boolean;
  status: CompanyEventStatus;
  created_by_user_id?: string | null;
  rsvp: RsvpSummary;
  can_edit: boolean;
  can_delete: boolean;
  can_view_attendees: boolean;
}

export interface CompanyEventsPermissions {
  can_create: boolean;
  can_manage: boolean;
}

export interface CompanyEventsList {
  data: CompanyEvent[];
  permissions: CompanyEventsPermissions;
}

export interface CompanyEventPayload {
  title: string;
  description?: string;
  event_type?: CompanyEventType;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  timezone?: string;
  location?: string;
  meeting_url?: string;
  audience_type?: CompanyEventAudience;
  audience_department_ids?: string[];
  audience_person_ids?: string[];
  rsvp_enabled?: boolean;
}

export interface CompanyEventFilters {
  when?: 'upcoming' | 'past';
  from?: string;
  to?: string;
  event_type?: string;
  include_cancelled?: string;
  [key: string]: string | undefined;
}

export const companyEventsApi = {
  getAll: async (filters: CompanyEventFilters = {}): Promise<CompanyEventsList> =>
    api.get<CompanyEventsList>('/company-events', filters),

  get: async (id: string): Promise<CompanyEvent> =>
    api.get<CompanyEvent>(`/company-events/${id}`),

  create: async (data: CompanyEventPayload): Promise<CompanyEvent> =>
    api.post<CompanyEvent>('/company-events', data),

  update: async (id: string, data: Partial<CompanyEventPayload> & { status?: CompanyEventStatus }): Promise<CompanyEvent> =>
    api.patch<CompanyEvent>(`/company-events/${id}`, data),

  cancel: async (id: string): Promise<CompanyEvent> =>
    api.patch<CompanyEvent>(`/company-events/${id}`, { status: 'cancelled' }),

  delete: async (id: string): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/company-events/${id}`),

  rsvp: async (id: string, response: RsvpResponse): Promise<unknown> =>
    api.post(`/company-events/${id}/rsvp`, { response }),
};
