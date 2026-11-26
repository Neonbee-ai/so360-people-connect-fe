import { describe, it, expect } from 'vitest';
import { rateCurrencyOptions, rateCurrencyForPayload } from './shared';

describe('rateCurrencyOptions', () => {
  it('Given a base currency missing from the supported list / When options are built / Then it is offered first', () => {
    expect(rateCurrencyOptions(['USD', 'EUR'], 'AED')).toEqual(['AED', 'USD', 'EUR']);
  });
  it('Given a base currency already in the list / When options are built / Then the list is unchanged', () => {
    expect(rateCurrencyOptions(['USD', 'AED'], 'AED')).toEqual(['USD', 'AED']);
  });
  it('Given no base currency yet / When options are built / Then no currency is invented', () => {
    expect(rateCurrencyOptions(['EUR'], '')).toEqual(['EUR']);
  });
});

describe('rateCurrencyForPayload', () => {
  it('Given a chosen currency / When building the payload / Then it is sent', () => {
    expect(rateCurrencyForPayload('AED')).toBe('AED');
  });
  it('Given an empty currency / When building the payload / Then it is omitted so the backend applies the Core base currency, not USD', () => {
    expect(rateCurrencyForPayload('')).toBeUndefined();
    expect(rateCurrencyForPayload(null)).toBeUndefined();
  });
});
