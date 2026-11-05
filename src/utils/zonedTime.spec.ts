import { describe, it, expect } from 'vitest';
import { isoToWallTime, wallTimeToIso } from './zonedTime';

describe('Given wallTimeToIso', () => {
  it('When the zone is UTC / Then the wall time is the UTC instant', () => {
    expect(wallTimeToIso('2030-03-01T09:30', 'UTC')).toBe('2030-03-01T09:30:00.000Z');
  });

  it('When the zone is Asia/Kolkata (+05:30) / Then it shifts back 5h30', () => {
    expect(wallTimeToIso('2030-03-01T09:30', 'Asia/Kolkata')).toBe('2030-03-01T04:00:00.000Z');
  });

  it('When the zone observes DST (New York summer, -04:00) / Then the summer offset is used', () => {
    expect(wallTimeToIso('2030-07-01T09:00', 'America/New_York')).toBe('2030-07-01T13:00:00.000Z');
  });

  it('When the value is empty or malformed / Then it returns an empty string', () => {
    expect(wallTimeToIso('', 'UTC')).toBe('');
    expect(wallTimeToIso('not-a-date', 'UTC')).toBe('');
  });
});

describe('Given isoToWallTime', () => {
  it('When given a UTC instant and Asia/Kolkata / Then it returns the local wall time', () => {
    expect(isoToWallTime('2030-03-01T04:00:00.000Z', 'Asia/Kolkata')).toBe('2030-03-01T09:30');
  });

  it('When given null, empty or invalid input / Then it returns an empty string', () => {
    expect(isoToWallTime(null, 'UTC')).toBe('');
    expect(isoToWallTime('', 'UTC')).toBe('');
    expect(isoToWallTime('garbage', 'UTC')).toBe('');
  });

  it('When round-tripped / Then the wall time is preserved', () => {
    const wall = '2030-11-05T18:45';
    expect(isoToWallTime(wallTimeToIso(wall, 'Europe/London'), 'Europe/London')).toBe(wall);
  });
});
