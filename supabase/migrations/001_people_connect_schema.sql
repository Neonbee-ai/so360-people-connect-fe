-- SO360 People Connect Module Schema
-- Resource Control - People: Allocation, Time Capture, Cost Attribution, Utilization

-- Enable UUID extension (should already exist from core)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PEOPLE RESOURCE REGISTRY
-- =============================================================================

-- People: The core resource entity
CREATE TABLE IF NOT EXISTS people (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL,                          -- References core organizations
  tenant_id UUID NOT NULL,                       -- References core tenants
  partner_id UUID,                               -- Optional link to core partners table
  user_id UUID,                                  -- Optional link to auth user (for internal staff)

  -- Identity
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,

  -- Classification
  type TEXT NOT NULL CHECK (type IN ('employee', 'contractor')),
  department TEXT,
  job_title TEXT,

  -- Cost
  cost_rate NUMERIC(12,2) NOT NULL DEFAULT 0,     -- Cost per unit
  cost_rate_unit TEXT NOT NULL DEFAULT 'hour' CHECK (cost_rate_unit IN ('hour', 'day')),
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_rate NUMERIC(12,2) DEFAULT 0,           -- Optional billing/charge-out rate

  -- Availability
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),
  available_hours_per_day NUMERIC(4,2) DEFAULT 8.0,
  available_days_per_week INTEGER DEFAULT 5,

  -- Metadata
  start_date DATE,
  end_date DATE,                                  -- For contractors with end dates
  meta JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,                                -- User who created
  updated_by UUID                                 -- User who last updated
);

-- People Roles/Skills: Light tagging system
CREATE TABLE IF NOT EXISTS people_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  role_name TEXT NOT NULL,                        -- e.g., 'Senior Developer', 'Project Manager'
  skill_category TEXT,                            -- e.g., 'Engineering', 'Design', 'Management'
  proficiency TEXT DEFAULT 'intermediate' CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  is_primary BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 2. ALLOCATION ENGINE
-- =============================================================================

-- Allocations: Assign people to execution entities
CREATE TABLE IF NOT EXISTS allocations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  -- Execution Entity Reference (project, task, work order, etc.)
  entity_type TEXT NOT NULL,                      -- 'project', 'task', 'work_order', 'engagement'
  entity_id UUID NOT NULL,                        -- ID of the execution entity
  entity_name TEXT,                               -- Denormalized name for display

  -- Allocation Window
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Allocation Amount
  allocation_type TEXT NOT NULL DEFAULT 'percentage' CHECK (allocation_type IN ('percentage', 'hours')),
  allocation_value NUMERIC(6,2) NOT NULL,         -- % (0-100) or hours per day/week
  allocation_period TEXT DEFAULT 'daily' CHECK (allocation_period IN ('daily', 'weekly')),

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),

  -- Approval
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  notes TEXT,
  meta JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  -- Prevent overlapping 100%+ allocations via application logic
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_allocation_value CHECK (allocation_value > 0)
);

-- =============================================================================
-- 3. TIME CAPTURE
-- =============================================================================

-- Time Entries: Controlled time logging linked to person + execution entity
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  allocation_id UUID REFERENCES allocations(id),  -- Optional link to specific allocation

  -- What was worked on
  entity_type TEXT NOT NULL,                      -- Same as allocation entity_type
  entity_id UUID NOT NULL,
  entity_name TEXT,                               -- Denormalized

  -- Time Details
  work_date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL,
  description TEXT,                               -- Brief description of work done

  -- Cost Computation (Captured at entry time for immutability)
  cost_rate NUMERIC(12,2) NOT NULL,               -- Rate at time of entry
  cost_rate_unit TEXT NOT NULL DEFAULT 'hour',
  total_cost NUMERIC(14,2) GENERATED ALWAYS AS (hours * cost_rate) STORED,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Approval Gate
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  -- Metadata
  meta JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,

  -- Validation
  CONSTRAINT valid_hours CHECK (hours > 0 AND hours <= 24),
  CONSTRAINT valid_cost_rate CHECK (cost_rate >= 0)
);

-- =============================================================================
-- 4. PEOPLE EVENTS (Immutable Event Log)
-- =============================================================================

CREATE TABLE IF NOT EXISTS people_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Event Classification
  event_type TEXT NOT NULL,                       -- 'person_allocated', 'time_logged', 'timesheet_approved', 'person_released', etc.
  event_category TEXT NOT NULL DEFAULT 'people',  -- For filtering

  -- Subject
  person_id UUID REFERENCES people(id),
  entity_type TEXT,
  entity_id UUID,

  -- Event Data
  payload JSONB NOT NULL DEFAULT '{}',            -- Full event payload
  actor_id UUID,                                  -- Who triggered the event
  actor_name TEXT,

  -- Correlation
  source_id UUID,                                 -- ID of triggering record (allocation_id, time_entry_id, etc.)
  source_type TEXT,                               -- 'allocation', 'time_entry', etc.

  -- Immutable timestamp
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- No update/delete allowed - append only
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 5. UTILIZATION VIEWS (Read Models)
-- =============================================================================

-- Materialized view for utilization computation
CREATE TABLE IF NOT EXISTS utilization_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'weekly' CHECK (period_type IN ('daily', 'weekly', 'monthly')),

  -- Planned (from allocations)
  planned_hours NUMERIC(8,2) DEFAULT 0,
  available_hours NUMERIC(8,2) DEFAULT 0,

  -- Actual (from approved time entries)
  actual_hours NUMERIC(8,2) DEFAULT 0,
  actual_cost NUMERIC(14,2) DEFAULT 0,

  -- Computed Metrics
  utilization_pct NUMERIC(5,2) DEFAULT 0,         -- actual / available * 100
  allocation_pct NUMERIC(5,2) DEFAULT 0,          -- planned / available * 100
  variance_hours NUMERIC(8,2) DEFAULT 0,          -- actual - planned

  -- Signals
  is_idle BOOLEAN DEFAULT FALSE,                  -- utilization < threshold
  is_overallocated BOOLEAN DEFAULT FALSE,         -- allocation > 100%

  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(person_id, period_start, period_type)
);

-- =============================================================================
-- 6. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_people_org_id ON people(org_id);
CREATE INDEX IF NOT EXISTS idx_people_tenant_id ON people(tenant_id);
CREATE INDEX IF NOT EXISTS idx_people_status ON people(status);
CREATE INDEX IF NOT EXISTS idx_people_type ON people(type);

CREATE INDEX IF NOT EXISTS idx_people_roles_person_id ON people_roles(person_id);
CREATE INDEX IF NOT EXISTS idx_people_roles_org_id ON people_roles(org_id);

CREATE INDEX IF NOT EXISTS idx_allocations_person_id ON allocations(person_id);
CREATE INDEX IF NOT EXISTS idx_allocations_org_id ON allocations(org_id);
CREATE INDEX IF NOT EXISTS idx_allocations_entity ON allocations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_allocations_dates ON allocations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);

CREATE INDEX IF NOT EXISTS idx_time_entries_person_id ON time_entries(person_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_org_id ON time_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_entity ON time_entries(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_date ON time_entries(work_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);

CREATE INDEX IF NOT EXISTS idx_people_events_org_id ON people_events(org_id);
CREATE INDEX IF NOT EXISTS idx_people_events_person_id ON people_events(person_id);
CREATE INDEX IF NOT EXISTS idx_people_events_type ON people_events(event_type);
CREATE INDEX IF NOT EXISTS idx_people_events_occurred_at ON people_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_utilization_person_period ON utilization_snapshots(person_id, period_start);
CREATE INDEX IF NOT EXISTS idx_utilization_org_id ON utilization_snapshots(org_id);

-- =============================================================================
-- 7. RLS POLICIES
-- =============================================================================

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilization_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies: Allow service role full access (backend mutations only)
CREATE POLICY "Service role full access" ON people FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON people_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON allocations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON time_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON people_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON utilization_snapshots FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 8. FUNCTIONS
-- =============================================================================

-- Function to compute utilization for a person over a period
CREATE OR REPLACE FUNCTION compute_utilization(
  p_person_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_person RECORD;
  v_available_hours NUMERIC;
  v_planned_hours NUMERIC;
  v_actual_hours NUMERIC;
  v_actual_cost NUMERIC;
  v_working_days INTEGER;
  v_result JSON;
BEGIN
  -- Get person details
  SELECT * INTO v_person FROM people WHERE id = p_person_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Person not found');
  END IF;

  -- Calculate working days in period
  SELECT COUNT(*) INTO v_working_days
  FROM generate_series(p_period_start, p_period_end, '1 day'::interval) d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6); -- Exclude weekends

  -- Available hours
  v_available_hours := v_working_days * v_person.available_hours_per_day;

  -- Planned hours from allocations
  SELECT COALESCE(SUM(
    CASE
      WHEN a.allocation_type = 'hours' THEN a.allocation_value * v_working_days
      ELSE (a.allocation_value / 100.0) * v_available_hours
    END
  ), 0)
  INTO v_planned_hours
  FROM allocations a
  WHERE a.person_id = p_person_id
    AND a.status IN ('active', 'planned')
    AND a.start_date <= p_period_end
    AND a.end_date >= p_period_start;

  -- Actual hours from approved time entries
  SELECT
    COALESCE(SUM(te.hours), 0),
    COALESCE(SUM(te.total_cost), 0)
  INTO v_actual_hours, v_actual_cost
  FROM time_entries te
  WHERE te.person_id = p_person_id
    AND te.status = 'approved'
    AND te.work_date BETWEEN p_period_start AND p_period_end;

  -- Build result
  v_result := json_build_object(
    'person_id', p_person_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'available_hours', v_available_hours,
    'planned_hours', v_planned_hours,
    'actual_hours', v_actual_hours,
    'actual_cost', v_actual_cost,
    'utilization_pct', CASE WHEN v_available_hours > 0 THEN ROUND((v_actual_hours / v_available_hours) * 100, 2) ELSE 0 END,
    'allocation_pct', CASE WHEN v_available_hours > 0 THEN ROUND((v_planned_hours / v_available_hours) * 100, 2) ELSE 0 END,
    'variance_hours', v_actual_hours - v_planned_hours,
    'is_idle', v_actual_hours < (v_available_hours * 0.3),
    'is_overallocated', v_planned_hours > v_available_hours
  );

  RETURN v_result;
END;
$$;
