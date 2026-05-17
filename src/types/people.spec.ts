/**
 * Smoke tests for people.ts type module.
 * Since this file exports only TypeScript interfaces (no runtime code),
 * these tests verify that type-compatible objects can be constructed
 * and used as expected at the boundary of business logic.
 */
import { describe, it, expect } from 'vitest';
import type {
  Person,
  PersonStatus,
  PersonRole,
  Allocation,
  TimeEntry,
  PaginatedResponse,
  PeopleEvent,
} from './people';

describe('Given the people type module', () => {
  it('When a valid Person object is constructed / Then it satisfies the required fields', () => {
    const person: Person = {
      id: 'p1',
      org_id: 'o1',
      tenant_id: 't1',
      full_name: 'Alice Smith',
      type: 'employee',
      cost_rate: 75,
      cost_rate_unit: 'hour',
      currency: 'USD',
      status: 'active',
      available_hours_per_day: 8,
      available_days_per_week: 5,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    expect(person.full_name).toBe('Alice Smith');
    expect(person.type).toBe('employee');
    expect(person.status).toBe('active');
  });

  it('When PersonStatus values are used / Then all valid statuses are accepted', () => {
    const statuses: PersonStatus[] = ['active', 'inactive', 'on_leave', 'terminated'];
    expect(statuses).toHaveLength(4);
    expect(statuses).toContain('active');
    expect(statuses).toContain('terminated');
  });

  it('When a PersonRole is constructed / Then required fields are present', () => {
    const role: PersonRole = {
      id: 'r1',
      role_name: 'Frontend Developer',
      proficiency: 'advanced',
      is_primary: true,
    };
    expect(role.role_name).toBe('Frontend Developer');
    expect(role.proficiency).toBe('advanced');
  });

  it('When a PaginatedResponse is constructed / Then data array and meta are accessible', () => {
    const response: PaginatedResponse<{ id: string }> = {
      data: [{ id: 'item1' }, { id: 'item2' }],
      meta: { total: 2, page: 1, limit: 10 },
    };
    expect(response.data).toHaveLength(2);
    expect(response.meta.total).toBe(2);
  });

  it('When a PeopleEvent is constructed / Then required event fields are present', () => {
    const event: PeopleEvent = {
      id: 'ev1',
      org_id: 'o1',
      tenant_id: 't1',
      event_type: 'person_created',
      actor_id: 'u1',
      actor_name: 'Admin',
      occurred_at: '2024-06-01T00:00:00Z',
      payload: { full_name: 'Alice' },
    };
    expect(event.event_type).toBe('person_created');
    expect(event.actor_name).toBe('Admin');
  });

  it('When a contractor Person is constructed / Then type is contractor', () => {
    const contractor: Person = {
      id: 'p2',
      org_id: 'o1',
      tenant_id: 't1',
      full_name: 'Bob Contractor',
      type: 'contractor',
      cost_rate: 150,
      cost_rate_unit: 'day',
      currency: 'USD',
      status: 'active',
      available_hours_per_day: 6,
      available_days_per_week: 5,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    expect(contractor.type).toBe('contractor');
    expect(contractor.cost_rate_unit).toBe('day');
  });
});
