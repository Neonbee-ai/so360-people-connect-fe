import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3012;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
  console.warn('Supabase client not initialized:', error.message);
}

// =============================================================================
// MIDDLEWARE: Extract context from headers
// =============================================================================
const extractContext = (req) => {
  return {
    tenantId: req.headers['x-tenant-id'] || '',
    orgId: req.headers['x-org-id'] || '',
    userId: req.headers['x-user-id'] || '',
    userName: req.headers['x-user-name'] || 'System',
    token: req.headers['authorization']?.replace('Bearer ', ''),
  };
};

// Validation middleware
const requireContext = (req, res, next) => {
  const ctx = extractContext(req);
  if (!ctx.tenantId || !ctx.orgId) {
    return res.status(400).json({
      error_code: 'MISSING_CONTEXT',
      message: 'X-Tenant-Id and X-Org-Id headers are required',
    });
  }
  req.ctx = ctx;
  next();
};

// =============================================================================
// HELPER: Emit People Event
// =============================================================================
const emitEvent = async (eventData) => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('people_events')
      .insert(eventData)
      .select()
      .single();
    if (error) console.error('Event emission failed:', error);
    return data;
  } catch (e) {
    console.error('Event emission error:', e);
    return null;
  }
};

// =============================================================================
// HEALTH CHECK
// =============================================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'people-connect', version: '1.0.0' });
});

// =============================================================================
// PEOPLE RESOURCE REGISTRY
// =============================================================================

// GET /people - List all people for an org
app.get('/people', requireContext, async (req, res) => {
  try {
    const { orgId, tenantId } = req.ctx;
    const { status, type, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!supabase) {
      return res.json({ data: getMockPeople(orgId, tenantId), meta: { total: 5, page: 1, limit: 20 } });
    }

    let query = supabase
      .from('people')
      .select('*, people_roles(*)', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      data: data || [],
      meta: { total: count || 0, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    console.error('GET /people error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// GET /people/:id - Get person details
app.get('/people/:id', requireContext, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      const mock = getMockPeople(req.ctx.orgId, req.ctx.tenantId).find(p => p.id === id);
      return mock ? res.json(mock) : res.status(404).json({ error_code: 'NOT_FOUND', message: 'Person not found' });
    }

    const { data, error } = await supabase
      .from('people')
      .select('*, people_roles(*)')
      .eq('id', id)
      .eq('org_id', req.ctx.orgId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error_code: 'NOT_FOUND', message: 'Person not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('GET /people/:id error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// POST /people - Create a person
app.post('/people', requireContext, async (req, res) => {
  try {
    const { orgId, tenantId, userId, userName } = req.ctx;
    const {
      full_name, email, phone, avatar_url, type,
      department, job_title, cost_rate, cost_rate_unit,
      currency, billing_rate, status, available_hours_per_day,
      available_days_per_week, start_date, end_date, roles, meta,
    } = req.body;

    if (!full_name || !type) {
      return res.status(400).json({
        error_code: 'VALIDATION_ERROR',
        message: 'full_name and type are required',
      });
    }

    if (!supabase) {
      const newPerson = {
        id: crypto.randomUUID(),
        org_id: orgId, tenant_id: tenantId,
        full_name, email, phone, avatar_url, type,
        department, job_title,
        cost_rate: cost_rate || 0, cost_rate_unit: cost_rate_unit || 'hour',
        currency: currency || 'USD', billing_rate: billing_rate || 0,
        status: status || 'active',
        available_hours_per_day: available_hours_per_day || 8,
        available_days_per_week: available_days_per_week || 5,
        start_date, end_date, meta: meta || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: userId, people_roles: [],
      };
      return res.status(201).json(newPerson);
    }

    const { data: person, error } = await supabase
      .from('people')
      .insert({
        org_id: orgId, tenant_id: tenantId,
        full_name, email, phone, avatar_url, type,
        department, job_title,
        cost_rate: cost_rate || 0, cost_rate_unit: cost_rate_unit || 'hour',
        currency: currency || 'USD', billing_rate: billing_rate || 0,
        status: status || 'active',
        available_hours_per_day: available_hours_per_day || 8,
        available_days_per_week: available_days_per_week || 5,
        start_date, end_date, meta: meta || {},
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Add roles if provided
    if (roles && roles.length > 0) {
      const roleInserts = roles.map(r => ({
        person_id: person.id,
        org_id: orgId,
        tenant_id: tenantId,
        role_name: r.role_name,
        skill_category: r.skill_category,
        proficiency: r.proficiency || 'intermediate',
        is_primary: r.is_primary || false,
      }));

      await supabase.from('people_roles').insert(roleInserts);
    }

    // Emit event
    await emitEvent({
      org_id: orgId, tenant_id: tenantId,
      event_type: 'person_created', event_category: 'people',
      person_id: person.id,
      payload: { person_id: person.id, full_name, type },
      actor_id: userId, actor_name: userName,
      source_id: person.id, source_type: 'person',
    });

    // Fetch complete record with roles
    const { data: complete } = await supabase
      .from('people')
      .select('*, people_roles(*)')
      .eq('id', person.id)
      .single();

    res.status(201).json(complete || person);
  } catch (error) {
    console.error('POST /people error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// PATCH /people/:id - Update a person
app.patch('/people/:id', requireContext, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.ctx;
    const updates = { ...req.body, updated_by: userId, updated_at: new Date().toISOString() };

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.org_id;
    delete updates.tenant_id;
    delete updates.created_at;
    delete updates.created_by;
    delete updates.people_roles;

    if (!supabase) {
      return res.json({ id, ...updates });
    }

    const { data, error } = await supabase
      .from('people')
      .update(updates)
      .eq('id', id)
      .eq('org_id', req.ctx.orgId)
      .select('*, people_roles(*)')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error_code: 'NOT_FOUND', message: 'Person not found' });

    res.json(data);
  } catch (error) {
    console.error('PATCH /people/:id error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// DELETE /people/:id - Soft delete (set status to terminated)
app.delete('/people/:id', requireContext, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.json({ message: 'Person terminated', id });
    }

    const { data, error } = await supabase
      .from('people')
      .update({ status: 'terminated', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', req.ctx.orgId)
      .select()
      .single();

    if (error) throw error;

    await emitEvent({
      org_id: req.ctx.orgId, tenant_id: req.ctx.tenantId,
      event_type: 'person_released', event_category: 'people',
      person_id: id,
      payload: { person_id: id, reason: 'terminated' },
      actor_id: req.ctx.userId, actor_name: req.ctx.userName,
      source_id: id, source_type: 'person',
    });

    res.json({ message: 'Person terminated', data });
  } catch (error) {
    console.error('DELETE /people/:id error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// =============================================================================
// PEOPLE ROLES
// =============================================================================

// POST /people/:id/roles - Add role to person
app.post('/people/:personId/roles', requireContext, async (req, res) => {
  try {
    const { personId } = req.params;
    const { role_name, skill_category, proficiency, is_primary } = req.body;

    if (!role_name) {
      return res.status(400).json({ error_code: 'VALIDATION_ERROR', message: 'role_name is required' });
    }

    if (!supabase) {
      return res.status(201).json({
        id: crypto.randomUUID(), person_id: personId,
        org_id: req.ctx.orgId, tenant_id: req.ctx.tenantId,
        role_name, skill_category, proficiency: proficiency || 'intermediate',
        is_primary: is_primary || false,
        created_at: new Date().toISOString(),
      });
    }

    const { data, error } = await supabase
      .from('people_roles')
      .insert({
        person_id: personId, org_id: req.ctx.orgId, tenant_id: req.ctx.tenantId,
        role_name, skill_category, proficiency: proficiency || 'intermediate',
        is_primary: is_primary || false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('POST /people/:id/roles error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// DELETE /people/:personId/roles/:roleId
app.delete('/people/:personId/roles/:roleId', requireContext, async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!supabase) {
      return res.json({ message: 'Role removed' });
    }

    const { error } = await supabase
      .from('people_roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;
    res.json({ message: 'Role removed' });
  } catch (error) {
    console.error('DELETE role error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// =============================================================================
// ALLOCATIONS
// =============================================================================

// GET /allocations - List allocations
app.get('/allocations', requireContext, async (req, res) => {
  try {
    const { orgId, tenantId } = req.ctx;
    const { person_id, entity_id, entity_type, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!supabase) {
      return res.json({ data: getMockAllocations(orgId, tenantId), meta: { total: 3, page: 1, limit: 20 } });
    }

    let query = supabase
      .from('allocations')
      .select('*, person:people(id, full_name, email, avatar_url, job_title)', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('tenant_id', tenantId)
      .order('start_date', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (person_id) query = query.eq('person_id', person_id);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      data: data || [],
      meta: { total: count || 0, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    console.error('GET /allocations error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// GET /allocations/:id
app.get('/allocations/:id', requireContext, async (req, res) => {
  try {
    if (!supabase) {
      return res.json(getMockAllocations(req.ctx.orgId, req.ctx.tenantId)[0]);
    }

    const { data, error } = await supabase
      .from('allocations')
      .select('*, person:people(id, full_name, email, avatar_url, job_title)')
      .eq('id', req.params.id)
      .eq('org_id', req.ctx.orgId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error_code: 'NOT_FOUND', message: 'Allocation not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('GET /allocations/:id error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// POST /allocations - Create allocation
app.post('/allocations', requireContext, async (req, res) => {
  try {
    const { orgId, tenantId, userId, userName } = req.ctx;
    const {
      person_id, entity_type, entity_id, entity_name,
      start_date, end_date, allocation_type, allocation_value,
      allocation_period, status, notes, meta,
    } = req.body;

    if (!person_id || !entity_type || !entity_id || !start_date || !end_date || !allocation_value) {
      return res.status(400).json({
        error_code: 'VALIDATION_ERROR',
        message: 'person_id, entity_type, entity_id, start_date, end_date, and allocation_value are required',
      });
    }

    if (!supabase) {
      const newAllocation = {
        id: crypto.randomUUID(),
        org_id: orgId, tenant_id: tenantId, person_id,
        entity_type, entity_id, entity_name,
        start_date, end_date,
        allocation_type: allocation_type || 'percentage',
        allocation_value, allocation_period: allocation_period || 'daily',
        status: status || 'active', notes, meta: meta || {},
        created_at: new Date().toISOString(),
        created_by: userId,
      };
      return res.status(201).json(newAllocation);
    }

    const { data, error } = await supabase
      .from('allocations')
      .insert({
        org_id: orgId, tenant_id: tenantId, person_id,
        entity_type, entity_id, entity_name,
        start_date, end_date,
        allocation_type: allocation_type || 'percentage',
        allocation_value, allocation_period: allocation_period || 'daily',
        status: status || 'active', notes, meta: meta || {},
        created_by: userId,
      })
      .select('*, person:people(id, full_name, email, avatar_url, job_title)')
      .single();

    if (error) throw error;

    // Emit event
    await emitEvent({
      org_id: orgId, tenant_id: tenantId,
      event_type: 'person_allocated', event_category: 'people',
      person_id, entity_type, entity_id,
      payload: {
        person_id, entity_type, entity_id, entity_name,
        allocation_value, allocation_type: allocation_type || 'percentage',
        start_date, end_date,
      },
      actor_id: userId, actor_name: userName,
      source_id: data.id, source_type: 'allocation',
    });

    res.status(201).json(data);
  } catch (error) {
    console.error('POST /allocations error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// PATCH /allocations/:id - Update allocation
app.patch('/allocations/:id', requireContext, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_by: req.ctx.userId, updated_at: new Date().toISOString() };

    delete updates.id;
    delete updates.org_id;
    delete updates.tenant_id;
    delete updates.person_id;
    delete updates.created_at;
    delete updates.created_by;

    if (!supabase) {
      return res.json({ id, ...updates });
    }

    const { data, error } = await supabase
      .from('allocations')
      .update(updates)
      .eq('id', id)
      .eq('org_id', req.ctx.orgId)
      .select('*, person:people(id, full_name, email, avatar_url, job_title)')
      .single();

    if (error) throw error;

    // If status changed to completed, emit person_released event
    if (updates.status === 'completed') {
      await emitEvent({
        org_id: req.ctx.orgId, tenant_id: req.ctx.tenantId,
        event_type: 'person_released', event_category: 'people',
        person_id: data.person_id,
        entity_type: data.entity_type, entity_id: data.entity_id,
        payload: { allocation_id: id, person_id: data.person_id, reason: 'allocation_completed' },
        actor_id: req.ctx.userId, actor_name: req.ctx.userName,
        source_id: id, source_type: 'allocation',
      });
    }

    res.json(data);
  } catch (error) {
    console.error('PATCH /allocations/:id error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// DELETE /allocations/:id
app.delete('/allocations/:id', requireContext, async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ message: 'Allocation cancelled' });
    }

    const { data, error } = await supabase
      .from('allocations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.ctx.orgId)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Allocation cancelled', data });
  } catch (error) {
    console.error('DELETE /allocations/:id error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// =============================================================================
// TIME ENTRIES
// =============================================================================

// GET /time-entries - List time entries
app.get('/time-entries', requireContext, async (req, res) => {
  try {
    const { orgId, tenantId } = req.ctx;
    const { person_id, entity_id, status, from_date, to_date, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!supabase) {
      return res.json({ data: getMockTimeEntries(orgId, tenantId), meta: { total: 4, page: 1, limit: 20 } });
    }

    let query = supabase
      .from('time_entries')
      .select('*, person:people(id, full_name, email, avatar_url, job_title, cost_rate)', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('tenant_id', tenantId)
      .order('work_date', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (person_id) query = query.eq('person_id', person_id);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (status) query = query.eq('status', status);
    if (from_date) query = query.gte('work_date', from_date);
    if (to_date) query = query.lte('work_date', to_date);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      data: data || [],
      meta: { total: count || 0, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    console.error('GET /time-entries error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// POST /time-entries - Log time
app.post('/time-entries', requireContext, async (req, res) => {
  try {
    const { orgId, tenantId, userId, userName } = req.ctx;
    const {
      person_id, allocation_id, entity_type, entity_id, entity_name,
      work_date, hours, description, meta,
    } = req.body;

    if (!person_id || !entity_type || !entity_id || !work_date || !hours) {
      return res.status(400).json({
        error_code: 'VALIDATION_ERROR',
        message: 'person_id, entity_type, entity_id, work_date, and hours are required',
      });
    }

    // Get person's cost rate for immutable cost capture
    let costRate = 0;
    let costRateUnit = 'hour';
    let currency = 'USD';

    if (supabase) {
      const { data: person } = await supabase
        .from('people')
        .select('cost_rate, cost_rate_unit, currency')
        .eq('id', person_id)
        .single();

      if (person) {
        costRate = person.cost_rate;
        costRateUnit = person.cost_rate_unit;
        currency = person.currency;
      }
    }

    if (!supabase) {
      const entry = {
        id: crypto.randomUUID(),
        org_id: orgId, tenant_id: tenantId, person_id,
        allocation_id, entity_type, entity_id, entity_name,
        work_date, hours, description,
        cost_rate: costRate, cost_rate_unit: costRateUnit,
        total_cost: hours * costRate, currency,
        status: 'draft', meta: meta || {},
        created_at: new Date().toISOString(),
        created_by: userId,
      };
      return res.status(201).json(entry);
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        org_id: orgId, tenant_id: tenantId, person_id,
        allocation_id, entity_type, entity_id, entity_name,
        work_date, hours, description,
        cost_rate: costRate, cost_rate_unit: costRateUnit, currency,
        status: 'draft', meta: meta || {},
        created_by: userId,
      })
      .select('*, person:people(id, full_name, email, avatar_url)')
      .single();

    if (error) throw error;

    // Emit event
    await emitEvent({
      org_id: orgId, tenant_id: tenantId,
      event_type: 'time_logged', event_category: 'people',
      person_id, entity_type, entity_id,
      payload: { time_entry_id: data.id, person_id, hours, work_date, entity_name, cost: hours * costRate },
      actor_id: userId, actor_name: userName,
      source_id: data.id, source_type: 'time_entry',
    });

    res.status(201).json(data);
  } catch (error) {
    console.error('POST /time-entries error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// PATCH /time-entries/:id - Update time entry (only draft/submitted)
app.patch('/time-entries/:id', requireContext, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.json({ id, ...req.body });
    }

    // Check current status - cannot edit approved entries
    const { data: existing } = await supabase
      .from('time_entries')
      .select('status')
      .eq('id', id)
      .single();

    if (existing?.status === 'approved') {
      return res.status(403).json({
        error_code: 'FORBIDDEN',
        message: 'Cannot edit approved time entries',
      });
    }

    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id;
    delete updates.org_id;
    delete updates.tenant_id;
    delete updates.person_id;
    delete updates.created_at;
    delete updates.total_cost;

    const { data, error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', id)
      .eq('org_id', req.ctx.orgId)
      .select('*, person:people(id, full_name, email, avatar_url)')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('PATCH /time-entries/:id error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// POST /time-entries/:id/submit - Submit time entry for approval
app.post('/time-entries/:id/submit', requireContext, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.json({ id, status: 'submitted', submitted_at: new Date().toISOString() });
    }

    const { data, error } = await supabase
      .from('time_entries')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', req.ctx.orgId)
      .eq('status', 'draft')
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(400).json({ error_code: 'INVALID_STATE', message: 'Entry must be in draft status' });

    res.json(data);
  } catch (error) {
    console.error('POST /time-entries/:id/submit error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// POST /time-entries/:id/approve - Approve time entry (manager action)
app.post('/time-entries/:id/approve', requireContext, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, orgId, tenantId } = req.ctx;

    if (!supabase) {
      return res.json({
        id, status: 'approved',
        approved_by: userId, approved_at: new Date().toISOString(),
      });
    }

    const { data, error } = await supabase
      .from('time_entries')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('status', 'submitted')
      .select('*, person:people(id, full_name, cost_rate)')
      .single();

    if (error) throw error;
    if (!data) return res.status(400).json({ error_code: 'INVALID_STATE', message: 'Entry must be in submitted status' });

    // Emit timesheet_approved event - this triggers cost attribution downstream
    await emitEvent({
      org_id: orgId, tenant_id: tenantId,
      event_type: 'timesheet_approved', event_category: 'people',
      person_id: data.person_id,
      entity_type: data.entity_type, entity_id: data.entity_id,
      payload: {
        time_entry_id: id,
        person_id: data.person_id,
        hours: data.hours,
        total_cost: data.total_cost,
        currency: data.currency,
        work_date: data.work_date,
        entity_name: data.entity_name,
        approved_by: userId,
      },
      actor_id: userId, actor_name: userName,
      source_id: id, source_type: 'time_entry',
    });

    res.json(data);
  } catch (error) {
    console.error('POST /time-entries/:id/approve error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// POST /time-entries/:id/reject - Reject time entry
app.post('/time-entries/:id/reject', requireContext, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!supabase) {
      return res.json({ id, status: 'rejected', rejection_reason: reason });
    }

    const { data, error } = await supabase
      .from('time_entries')
      .update({
        status: 'rejected',
        rejection_reason: reason || 'No reason provided',
      })
      .eq('id', id)
      .eq('org_id', req.ctx.orgId)
      .eq('status', 'submitted')
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(400).json({ error_code: 'INVALID_STATE', message: 'Entry must be in submitted status' });

    res.json(data);
  } catch (error) {
    console.error('POST /time-entries/:id/reject error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// DELETE /time-entries/:id - Delete time entry (only draft)
app.delete('/time-entries/:id', requireContext, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.json({ message: 'Time entry deleted' });
    }

    const { data: existing } = await supabase
      .from('time_entries')
      .select('status')
      .eq('id', id)
      .single();

    if (existing?.status !== 'draft') {
      return res.status(403).json({
        error_code: 'FORBIDDEN',
        message: 'Only draft time entries can be deleted',
      });
    }

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id)
      .eq('org_id', req.ctx.orgId);

    if (error) throw error;
    res.json({ message: 'Time entry deleted' });
  } catch (error) {
    console.error('DELETE /time-entries/:id error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// =============================================================================
// UTILIZATION
// =============================================================================

// GET /utilization - Get utilization data for org
app.get('/utilization', requireContext, async (req, res) => {
  try {
    const { orgId, tenantId } = req.ctx;
    const { period_start, period_end, person_id } = req.query;

    const start = period_start || getWeekStart();
    const end = period_end || getWeekEnd();

    if (!supabase) {
      return res.json({ data: getMockUtilization(orgId), period: { start, end } });
    }

    // Get all active people
    let peopleQuery = supabase
      .from('people')
      .select('id, full_name, email, avatar_url, job_title, cost_rate, available_hours_per_day, status')
      .eq('org_id', orgId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (person_id) peopleQuery = peopleQuery.eq('id', person_id);

    const { data: people } = await peopleQuery;

    if (!people || people.length === 0) {
      return res.json({ data: [], period: { start, end } });
    }

    // Compute utilization for each person
    const utilizationData = await Promise.all(
      people.map(async (person) => {
        const { data: result } = await supabase.rpc('compute_utilization', {
          p_person_id: person.id,
          p_period_start: start,
          p_period_end: end,
        });

        return {
          person,
          utilization: result || {
            available_hours: 0, planned_hours: 0, actual_hours: 0,
            actual_cost: 0, utilization_pct: 0, allocation_pct: 0,
            variance_hours: 0, is_idle: true, is_overallocated: false,
          },
        };
      })
    );

    res.json({ data: utilizationData, period: { start, end } });
  } catch (error) {
    console.error('GET /utilization error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// GET /utilization/summary - Org-level utilization summary
app.get('/utilization/summary', requireContext, async (req, res) => {
  try {
    const { orgId, tenantId } = req.ctx;

    if (!supabase) {
      return res.json(getMockUtilizationSummary());
    }

    // Get aggregate data
    const { data: people } = await supabase
      .from('people')
      .select('id, cost_rate, available_hours_per_day, status')
      .eq('org_id', orgId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    const totalPeople = people?.length || 0;

    // Get recent time entries for burn rate
    const weekStart = getWeekStart();
    const weekEnd = getWeekEnd();

    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select('hours, total_cost')
      .eq('org_id', orgId)
      .eq('status', 'approved')
      .gte('work_date', weekStart)
      .lte('work_date', weekEnd);

    const totalApprovedHours = timeEntries?.reduce((sum, te) => sum + parseFloat(te.hours), 0) || 0;
    const totalCost = timeEntries?.reduce((sum, te) => sum + parseFloat(te.total_cost || 0), 0) || 0;
    const totalAvailableHours = (people || []).reduce((sum, p) => sum + (p.available_hours_per_day * 5), 0);
    const avgUtilization = totalAvailableHours > 0 ? Math.round((totalApprovedHours / totalAvailableHours) * 100) : 0;

    // Get active allocations count
    const { count: activeAllocations } = await supabase
      .from('allocations')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active');

    // Pending approvals
    const { count: pendingApprovals } = await supabase
      .from('time_entries')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'submitted');

    res.json({
      total_people: totalPeople,
      active_allocations: activeAllocations || 0,
      avg_utilization_pct: avgUtilization,
      total_hours_this_week: totalApprovedHours,
      total_cost_this_week: totalCost,
      pending_approvals: pendingApprovals || 0,
      burn_rate_daily: totalCost / 5, // Simplified daily burn
      period: { start: weekStart, end: weekEnd },
    });
  } catch (error) {
    console.error('GET /utilization/summary error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// =============================================================================
// PEOPLE EVENTS
// =============================================================================

// GET /events - List people events
app.get('/events', requireContext, async (req, res) => {
  try {
    const { orgId, tenantId } = req.ctx;
    const { person_id, event_type, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!supabase) {
      return res.json({ data: getMockEvents(), meta: { total: 5, page: 1, limit: 50 } });
    }

    let query = supabase
      .from('people_events')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (person_id) query = query.eq('person_id', person_id);
    if (event_type) query = query.eq('event_type', event_type);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      data: data || [],
      meta: { total: count || 0, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    console.error('GET /events error:', error);
    res.status(500).json({ error_code: 'INTERNAL_ERROR', message: error.message });
  }
});

// =============================================================================
// MOCK DATA (For development without Supabase)
// =============================================================================

function getMockPeople(orgId, tenantId) {
  return [
    {
      id: 'p-001', org_id: orgId, tenant_id: tenantId,
      full_name: 'Alice Johnson', email: 'alice@company.com', phone: '+1-555-0101',
      type: 'employee', department: 'Engineering', job_title: 'Senior Developer',
      cost_rate: 85.00, cost_rate_unit: 'hour', currency: 'USD', billing_rate: 150.00,
      status: 'active', available_hours_per_day: 8, available_days_per_week: 5,
      start_date: '2023-01-15', avatar_url: null, meta: {},
      created_at: '2023-01-15T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      people_roles: [
        { id: 'r-001', role_name: 'Full Stack Developer', skill_category: 'Engineering', proficiency: 'expert', is_primary: true },
        { id: 'r-002', role_name: 'Tech Lead', skill_category: 'Management', proficiency: 'advanced', is_primary: false },
      ],
    },
    {
      id: 'p-002', org_id: orgId, tenant_id: tenantId,
      full_name: 'Bob Smith', email: 'bob@company.com', phone: '+1-555-0102',
      type: 'employee', department: 'Design', job_title: 'UX Designer',
      cost_rate: 75.00, cost_rate_unit: 'hour', currency: 'USD', billing_rate: 130.00,
      status: 'active', available_hours_per_day: 8, available_days_per_week: 5,
      start_date: '2023-03-01', avatar_url: null, meta: {},
      created_at: '2023-03-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      people_roles: [
        { id: 'r-003', role_name: 'UX Designer', skill_category: 'Design', proficiency: 'advanced', is_primary: true },
      ],
    },
    {
      id: 'p-003', org_id: orgId, tenant_id: tenantId,
      full_name: 'Carol Williams', email: 'carol@external.com', phone: '+1-555-0103',
      type: 'contractor', department: 'Engineering', job_title: 'DevOps Engineer',
      cost_rate: 120.00, cost_rate_unit: 'hour', currency: 'USD', billing_rate: 180.00,
      status: 'active', available_hours_per_day: 6, available_days_per_week: 4,
      start_date: '2024-01-01', end_date: '2024-12-31', avatar_url: null, meta: {},
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      people_roles: [
        { id: 'r-004', role_name: 'DevOps Engineer', skill_category: 'Engineering', proficiency: 'expert', is_primary: true },
      ],
    },
    {
      id: 'p-004', org_id: orgId, tenant_id: tenantId,
      full_name: 'David Chen', email: 'david@company.com', phone: '+1-555-0104',
      type: 'employee', department: 'Product', job_title: 'Product Manager',
      cost_rate: 95.00, cost_rate_unit: 'hour', currency: 'USD', billing_rate: 160.00,
      status: 'active', available_hours_per_day: 8, available_days_per_week: 5,
      start_date: '2022-06-01', avatar_url: null, meta: {},
      created_at: '2022-06-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      people_roles: [
        { id: 'r-005', role_name: 'Product Manager', skill_category: 'Product', proficiency: 'advanced', is_primary: true },
      ],
    },
    {
      id: 'p-005', org_id: orgId, tenant_id: tenantId,
      full_name: 'Eve Martinez', email: 'eve@company.com', phone: '+1-555-0105',
      type: 'employee', department: 'Engineering', job_title: 'QA Engineer',
      cost_rate: 65.00, cost_rate_unit: 'hour', currency: 'USD', billing_rate: 110.00,
      status: 'inactive', available_hours_per_day: 8, available_days_per_week: 5,
      start_date: '2023-09-01', avatar_url: null, meta: {},
      created_at: '2023-09-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      people_roles: [
        { id: 'r-006', role_name: 'QA Engineer', skill_category: 'Engineering', proficiency: 'intermediate', is_primary: true },
      ],
    },
  ];
}

function getMockAllocations(orgId, tenantId) {
  return [
    {
      id: 'a-001', org_id: orgId, tenant_id: tenantId, person_id: 'p-001',
      entity_type: 'project', entity_id: 'proj-001', entity_name: 'Website Redesign',
      start_date: '2024-01-15', end_date: '2024-03-30',
      allocation_type: 'percentage', allocation_value: 60, allocation_period: 'daily',
      status: 'active', notes: 'Lead developer on frontend',
      created_at: '2024-01-10T00:00:00Z',
      person: { id: 'p-001', full_name: 'Alice Johnson', email: 'alice@company.com', avatar_url: null, job_title: 'Senior Developer' },
    },
    {
      id: 'a-002', org_id: orgId, tenant_id: tenantId, person_id: 'p-001',
      entity_type: 'project', entity_id: 'proj-002', entity_name: 'API Migration',
      start_date: '2024-02-01', end_date: '2024-04-30',
      allocation_type: 'percentage', allocation_value: 40, allocation_period: 'daily',
      status: 'active', notes: 'Backend API work',
      created_at: '2024-01-25T00:00:00Z',
      person: { id: 'p-001', full_name: 'Alice Johnson', email: 'alice@company.com', avatar_url: null, job_title: 'Senior Developer' },
    },
    {
      id: 'a-003', org_id: orgId, tenant_id: tenantId, person_id: 'p-002',
      entity_type: 'project', entity_id: 'proj-001', entity_name: 'Website Redesign',
      start_date: '2024-01-15', end_date: '2024-03-30',
      allocation_type: 'percentage', allocation_value: 80, allocation_period: 'daily',
      status: 'active', notes: 'Design lead',
      created_at: '2024-01-10T00:00:00Z',
      person: { id: 'p-002', full_name: 'Bob Smith', email: 'bob@company.com', avatar_url: null, job_title: 'UX Designer' },
    },
  ];
}

function getMockTimeEntries(orgId, tenantId) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  return [
    {
      id: 'te-001', org_id: orgId, tenant_id: tenantId, person_id: 'p-001',
      entity_type: 'project', entity_id: 'proj-001', entity_name: 'Website Redesign',
      work_date: today, hours: 6, description: 'Implemented new navigation component',
      cost_rate: 85.00, cost_rate_unit: 'hour', total_cost: 510.00, currency: 'USD',
      status: 'submitted', submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      person: { id: 'p-001', full_name: 'Alice Johnson', email: 'alice@company.com', avatar_url: null, job_title: 'Senior Developer', cost_rate: 85.00 },
    },
    {
      id: 'te-002', org_id: orgId, tenant_id: tenantId, person_id: 'p-001',
      entity_type: 'project', entity_id: 'proj-002', entity_name: 'API Migration',
      work_date: today, hours: 2, description: 'API endpoint refactoring',
      cost_rate: 85.00, cost_rate_unit: 'hour', total_cost: 170.00, currency: 'USD',
      status: 'draft',
      created_at: new Date().toISOString(),
      person: { id: 'p-001', full_name: 'Alice Johnson', email: 'alice@company.com', avatar_url: null, job_title: 'Senior Developer', cost_rate: 85.00 },
    },
    {
      id: 'te-003', org_id: orgId, tenant_id: tenantId, person_id: 'p-002',
      entity_type: 'project', entity_id: 'proj-001', entity_name: 'Website Redesign',
      work_date: yesterday, hours: 7, description: 'User research and wireframing',
      cost_rate: 75.00, cost_rate_unit: 'hour', total_cost: 525.00, currency: 'USD',
      status: 'approved', approved_by: 'user-mgr-001', approved_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
      person: { id: 'p-002', full_name: 'Bob Smith', email: 'bob@company.com', avatar_url: null, job_title: 'UX Designer', cost_rate: 75.00 },
    },
    {
      id: 'te-004', org_id: orgId, tenant_id: tenantId, person_id: 'p-003',
      entity_type: 'project', entity_id: 'proj-002', entity_name: 'API Migration',
      work_date: yesterday, hours: 5, description: 'CI/CD pipeline configuration',
      cost_rate: 120.00, cost_rate_unit: 'hour', total_cost: 600.00, currency: 'USD',
      status: 'submitted', submitted_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
      person: { id: 'p-003', full_name: 'Carol Williams', email: 'carol@external.com', avatar_url: null, job_title: 'DevOps Engineer', cost_rate: 120.00 },
    },
  ];
}

function getMockUtilization(orgId) {
  return [
    {
      person: { id: 'p-001', full_name: 'Alice Johnson', email: 'alice@company.com', job_title: 'Senior Developer', cost_rate: 85.00, available_hours_per_day: 8, status: 'active' },
      utilization: { available_hours: 40, planned_hours: 40, actual_hours: 32, actual_cost: 2720, utilization_pct: 80, allocation_pct: 100, variance_hours: -8, is_idle: false, is_overallocated: true },
    },
    {
      person: { id: 'p-002', full_name: 'Bob Smith', email: 'bob@company.com', job_title: 'UX Designer', cost_rate: 75.00, available_hours_per_day: 8, status: 'active' },
      utilization: { available_hours: 40, planned_hours: 32, actual_hours: 28, actual_cost: 2100, utilization_pct: 70, allocation_pct: 80, variance_hours: -4, is_idle: false, is_overallocated: false },
    },
    {
      person: { id: 'p-003', full_name: 'Carol Williams', email: 'carol@external.com', job_title: 'DevOps Engineer', cost_rate: 120.00, available_hours_per_day: 6, status: 'active' },
      utilization: { available_hours: 24, planned_hours: 20, actual_hours: 18, actual_cost: 2160, utilization_pct: 75, allocation_pct: 83, variance_hours: -2, is_idle: false, is_overallocated: false },
    },
    {
      person: { id: 'p-004', full_name: 'David Chen', email: 'david@company.com', job_title: 'Product Manager', cost_rate: 95.00, available_hours_per_day: 8, status: 'active' },
      utilization: { available_hours: 40, planned_hours: 16, actual_hours: 10, actual_cost: 950, utilization_pct: 25, allocation_pct: 40, variance_hours: -6, is_idle: true, is_overallocated: false },
    },
  ];
}

function getMockUtilizationSummary() {
  return {
    total_people: 5,
    active_allocations: 3,
    avg_utilization_pct: 63,
    total_hours_this_week: 88,
    total_cost_this_week: 7930,
    pending_approvals: 2,
    burn_rate_daily: 1586,
    period: { start: getWeekStart(), end: getWeekEnd() },
  };
}

function getMockEvents() {
  return [
    { id: 'ev-001', event_type: 'person_allocated', person_id: 'p-001', entity_type: 'project', entity_id: 'proj-001', payload: { entity_name: 'Website Redesign', allocation_value: 60 }, actor_name: 'System Admin', occurred_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'ev-002', event_type: 'time_logged', person_id: 'p-001', entity_type: 'project', entity_id: 'proj-001', payload: { hours: 6, entity_name: 'Website Redesign' }, actor_name: 'Alice Johnson', occurred_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 'ev-003', event_type: 'timesheet_approved', person_id: 'p-002', entity_type: 'project', entity_id: 'proj-001', payload: { hours: 7, total_cost: 525, entity_name: 'Website Redesign' }, actor_name: 'System Admin', occurred_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'ev-004', event_type: 'person_created', person_id: 'p-003', payload: { full_name: 'Carol Williams', type: 'contractor' }, actor_name: 'System Admin', occurred_at: new Date(Date.now() - 172800000).toISOString() },
    { id: 'ev-005', event_type: 'person_allocated', person_id: 'p-002', entity_type: 'project', entity_id: 'proj-001', payload: { entity_name: 'Website Redesign', allocation_value: 80 }, actor_name: 'System Admin', occurred_at: new Date(Date.now() - 259200000).toISOString() },
  ];
}

// Helper functions
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

function getWeekEnd() {
  const start = new Date(getWeekStart());
  start.setDate(start.getDate() + 4);
  return start.toISOString().split('T')[0];
}

// =============================================================================
// START SERVER
// =============================================================================
app.listen(PORT, () => {
  console.log(`People Connect API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Supabase: ${supabase ? 'Connected' : 'Not connected (using mock data)'}`);
});
