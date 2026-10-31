import { describe, it, expect } from 'vitest';
import { masterPayloadForSubmit } from './masterPayload';

describe('masterPayloadForSubmit', () => {
  const base = { name: 'Contract', is_active: true };

  it('Given a list without the contractor flag / When submitting / Then is_contractor is never sent', () => {
    expect(masterPayloadForSubmit({ ...base, is_contractor: true }, null, false)).toEqual(base);
  });

  it('Given a new employment type left untouched / When creating / Then is_contractor is omitted (backend default applies)', () => {
    expect(masterPayloadForSubmit(base, null, true)).toEqual(base);
  });

  it('Given a new employment type toggled on / When creating / Then is_contractor true is sent', () => {
    expect(masterPayloadForSubmit({ ...base, is_contractor: true }, null, true)).toEqual({ ...base, is_contractor: true });
  });

  it('Given an edit that keeps the flag / When saving / Then is_contractor is omitted', () => {
    expect(masterPayloadForSubmit({ ...base, is_contractor: true }, { is_contractor: true }, true)).toEqual(base);
  });

  it('Given an edit that flips the flag / When saving / Then the new value is sent', () => {
    expect(masterPayloadForSubmit({ ...base, is_contractor: false }, { is_contractor: true }, true)).toEqual({ ...base, is_contractor: false });
  });
});
