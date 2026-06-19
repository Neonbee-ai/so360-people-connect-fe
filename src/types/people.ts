// =============================================================================
// People Connect - Type Definitions
// =============================================================================

// Person Resource
export interface Person {
  id: string;
  org_id: string;
  tenant_id: string;
  partner_id?: string;
  user_id?: string;

  // Identity
  full_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;

  // Classification
  type: 'employee' | 'contractor';
  /** @deprecated free-text department; use department_id + department_info */
  department?: string;
  department_id?: string | null;
  /** Hydrated department master record (resolves name even when archived) */
  department_info?: { id: string; name: string; code: string; is_active: boolean } | null;
  job_title?: string;

  // Cost
  cost_rate: number;
  cost_rate_unit: 'hour' | 'day';
  currency: string;
  billing_rate?: number;

  // Availability
  status: PersonStatus;
  available_hours_per_day: number;
  available_days_per_week: number;

  // Dates
  start_date?: string;
  end_date?: string;

  // Metadata
  meta?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;

  // Work Location
  work_location_id?: string;
  work_location?: { id: string; name: string; location_type: string } | null;

  // System access / identity unification (People Registry ↔ Team Management).
  // All optional — older payloads predate these and must still render.
  /** Whether this person has a usable login: active / pending invite / none. */
  access_status?: AccessStatus;
  /** Lifecycle of an outstanding user invitation, null when not invited. */
  invitation_status?: InvitationStatus | null;
  /** Core IAM login role name (e.g. 'Admin', 'Member'). Distinct from people_roles/skills. */
  system_role?: string | null;
  /** Login account state — 'blocked' overrides the access badge. */
  login_status?: LoginStatus;
  /** Linked Core user account, when one exists. */
  linked_user_id?: string | null;
  /** Last active timestamp (ISO) of the linked user. */
  last_active?: string | null;

  // Relations
  people_roles?: PersonRole[];
}

export type PersonStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';

export type AccessStatus = 'active' | 'pending' | 'no_access';
export type InvitationStatus = 'pending' | 'accepted' | 'expired';
export type LoginStatus = 'active' | 'blocked' | 'pending' | 'none';

export interface PersonRole {
  id: string;
  person_id?: string;
  org_id?: string;
  tenant_id?: string;
  role_name: string;
  skill_category?: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  is_primary: boolean;
  created_at?: string;
}

export interface CreatePersonPayload {
  full_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  type: 'employee' | 'contractor';
  /** @deprecated free-text department; use department_id */
  department?: string;
  department_id?: string | null;
  job_title?: string;
  cost_rate: number;
  cost_rate_unit?: 'hour' | 'day';
  currency?: string;
  billing_rate?: number;
  status?: PersonStatus;
  available_hours_per_day?: number;
  available_days_per_week?: number;
  start_date?: string;
  end_date?: string;
  roles?: Omit<PersonRole, 'id' | 'person_id' | 'org_id' | 'tenant_id' | 'created_at'>[];
  meta?: Record<string, unknown>;
  work_location_id?: string;
  userLinkageMode?: 'none' | 'link' | 'invite';
  existingUserId?: string;
  inviteEmail?: string;
  inviteRole?: string;
  sendInviteEmail?: boolean;
}

// Allocation
export interface Allocation {
  id: string;
  org_id: string;
  tenant_id: string;
  person_id: string;

  entity_type: string;
  entity_id: string;
  entity_name?: string;

  start_date: string;
  end_date: string;

  allocation_value: number;
  allocation_type: string;

  status: AllocationStatus;
  approved_by?: string;
  approved_at?: string;

  notes?: string;
  meta?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;

  // Joined
  person?: Pick<Person, 'id' | 'full_name' | 'email' | 'avatar_url' | 'job_title'>;
}

export type AllocationStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface CreateAllocationPayload {
  person_id: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  start_date: string;
  end_date?: string;
  // Backend contract: percentage allocation, integer-ish number in [1, 100].
  allocation_percentage: number;
  role?: string;
  budgeted_hours?: number;
  rate_override?: number;
  notes?: string;
  meta?: Record<string, unknown>;
}

export interface UpdateAllocationPayload {
  start_date?: string;
  end_date?: string;
  allocation_percentage?: number;
  status?: AllocationStatus;
  notes?: string;
}

// Time Entry types removed — time logging is consolidated into the Timesheets
// module. See src/services/timesheetApi.ts for the read-only consumer types.

// Entity Lookup (execution entities resolved from sibling services)
// `id` is always a real UUID — these populate the entity dropdowns so users
// never type a UUID by hand.
export type LookupEntityType =
  | 'project'
  | 'task'
  | 'deal'
  | 'opportunity'
  | 'lead'
  | 'customer'
  | 'department';

export interface EntityOption {
  id: string;
  name: string;
}

// Utilization
export interface UtilizationData {
  person: Pick<Person, 'id' | 'full_name' | 'email' | 'avatar_url' | 'job_title' | 'cost_rate' | 'available_hours_per_day' | 'status'>;
  utilization: {
    available_hours: number;
    planned_hours: number;
    actual_hours: number;
    actual_cost: number;
    utilization_pct: number;
    allocation_pct: number;
    variance_hours: number;
    is_idle: boolean;
    is_overallocated: boolean;
  };
}

export interface DepartmentHeadcountEntry {
  name: string;
  count: number;
}

export interface UtilizationSummary {
  total_people: number;
  active_allocations: number;
  avg_utilization_pct: number;
  total_hours_this_week: number;
  total_cost_this_week: number;
  pending_approvals: number;
  burn_rate_daily: number;
  available_resources: number;
  fully_allocated_resources: number;
  overallocated_resources: number;
  pending_leave_count: number;
  approved_leave_count: number;
  on_leave_today_count: number;
  department_headcount: DepartmentHeadcountEntry[];
}

// People Event
export interface PeopleEvent {
  id: string;
  org_id?: string;
  tenant_id?: string;
  event_type: string;
  event_category?: string;
  person_id?: string;
  entity_type?: string;
  entity_id?: string;
  payload: Record<string, unknown>;
  actor_id?: string;
  actor_name?: string;
  source_id?: string;
  source_type?: string;
  occurred_at: string;
  created_at?: string;
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
