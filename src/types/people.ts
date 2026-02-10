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
  department?: string;
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

  // Relations
  people_roles?: PersonRole[];
}

export type PersonStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';

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
  department?: string;
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

  allocation_type: 'percentage' | 'hours';
  allocation_value: number;
  allocation_period: 'daily' | 'weekly';

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
  end_date: string;
  allocation_type?: 'percentage' | 'hours';
  allocation_value: number;
  allocation_period?: 'daily' | 'weekly';
  status?: AllocationStatus;
  notes?: string;
  meta?: Record<string, unknown>;
}

// Time Entry
export interface TimeEntry {
  id: string;
  org_id: string;
  tenant_id: string;
  person_id: string;
  allocation_id?: string;

  entity_type: string;
  entity_id: string;
  entity_name?: string;

  work_date: string;
  hours: number;
  description?: string;

  cost_rate: number;
  cost_rate_unit: string;
  total_cost: number;
  currency: string;

  status: TimeEntryStatus;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;

  meta?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  created_by?: string;

  // Joined
  person?: Pick<Person, 'id' | 'full_name' | 'email' | 'avatar_url' | 'job_title' | 'cost_rate'>;
}

export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface CreateTimeEntryPayload {
  person_id: string;
  allocation_id?: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  work_date: string;
  hours: number;
  description?: string;
  meta?: Record<string, unknown>;
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

export interface UtilizationSummary {
  total_people: number;
  active_allocations: number;
  avg_utilization_pct: number;
  total_hours_this_week: number;
  total_cost_this_week: number;
  pending_approvals: number;
  burn_rate_daily: number;
  period: { start: string; end: string };
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
