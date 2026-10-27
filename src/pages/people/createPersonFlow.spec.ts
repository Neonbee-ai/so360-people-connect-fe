import { describe, it, expect } from 'vitest';
import { buildAtomicCreatePayload, inviteFailed } from './createPersonFlow';
import type { CreatePersonPayload } from '../../types/people';

const base = { full_name: 'Jane', type: 'employee', cost_rate: 0 } as CreatePersonPayload;

describe('Given Add Person form data with custom fields and leave overrides', () => {
  it('When the payload is built / Then both ride on one request under backend field names and UI-only keys are removed', () => {
    const payload = buildAtomicCreatePayload({
      ...base,
      customFieldValues: { 'f-1': 'O+' },
      leaveOverrides: [{ leave_type_id: 'lt-1', mode: 'include' }],
    } as any);
    expect(payload.custom_fields).toEqual([{ field_def_id: 'f-1', value: 'O+' }]);
    expect(payload.leave_override).toEqual([{ leave_type_id: 'lt-1', mode: 'include' }]);
    expect(payload).not.toHaveProperty('customFieldValues');
    expect(payload).not.toHaveProperty('leaveOverrides');
  });
});

describe('Given Add Person form data with nothing extra', () => {
  it('When the payload is built / Then no custom_fields or leave_override keys are sent', () => {
    const payload = buildAtomicCreatePayload({ ...base, customFieldValues: {}, leaveOverrides: [] } as any);
    expect(payload).not.toHaveProperty('custom_fields');
    expect(payload).not.toHaveProperty('leave_override');
  });
});

describe('Given the invite outcome from the create response', () => {
  it('When status is failed / Then inviteFailed is true', () => {
    expect(inviteFailed({ status: 'failed', error: 'x' })).toBe(true);
  });
  it('When status is sent, skipped or absent / Then inviteFailed is false', () => {
    expect(inviteFailed({ status: 'sent' })).toBe(false);
    expect(inviteFailed({ status: 'skipped' })).toBe(false);
    expect(inviteFailed(undefined)).toBe(false);
  });
});
