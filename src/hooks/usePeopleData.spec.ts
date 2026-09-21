import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
  },
  allocationsApi: { getAll: vi.fn() },
  utilizationApi: {
    getAll: vi.fn(),
    getSummary: vi.fn(),
  },
  eventsApi: { getAll: vi.fn() },
}));

import {
  usePeopleList,
  usePersonDetail,
  useAllocations,
  useUtilization,
  useUtilizationSummary,
  usePeopleEvents,
} from './usePeopleData';
import { peopleApi, allocationsApi, utilizationApi, eventsApi } from '../services/peopleService';

const mockPeopleApi = peopleApi as any;
const mockAllocsApi = allocationsApi as any;
const mockUtilApi = utilizationApi as any;
const mockEventsApi = eventsApi as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given usePeopleList hook', () => {
  it('When API resolves / Then data is returned and loading becomes false', async () => {
    const mockData = { data: [{ id: 'p1', full_name: 'Alice' }], total: 1 };
    mockPeopleApi.getAll.mockResolvedValue(mockData);
    const { result } = renderHook(() => usePeopleList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('When API rejects / Then error is set and loading becomes false', async () => {
    mockPeopleApi.getAll.mockImplementation(async () => { throw new Error('Network error'); });
    const { result } = renderHook(() => usePeopleList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('When hook mounts / Then loading starts as true', () => {
    mockPeopleApi.getAll.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => usePeopleList());
    expect(result.current.loading).toBe(true);
  });
});

describe('Given usePersonDetail hook', () => {
  it('When id is provided and API resolves / Then person data is returned', async () => {
    mockPeopleApi.getById.mockResolvedValue({ id: 'p1', full_name: 'Alice' });
    const { result } = renderHook(() => usePersonDetail('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect((result.current.data as any)?.full_name).toBe('Alice');
  });

  it('When id is undefined / Then error is set with No person ID message', async () => {
    mockPeopleApi.getById.mockResolvedValue({});
    const { result } = renderHook(() => usePersonDetail(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('No person ID');
  });
});

describe('Given useAllocations hook', () => {
  it('When API resolves / Then allocation data is returned', async () => {
    const mockData = { data: [{ id: 'a1' }], total: 1 };
    mockAllocsApi.getAll.mockResolvedValue(mockData);
    const { result } = renderHook(() => useAllocations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockData);
  });
});

// useTimeEntries hook removed — time logging is consolidated into the
// Timesheets module (see src/services/timesheetApi.spec.ts).

describe('Given useUtilizationSummary hook', () => {
  it('When API resolves / Then summary data is returned', async () => {
    const mockSummary = { total_people: 10, avg_utilization_pct: 70 };
    mockUtilApi.getSummary.mockResolvedValue(mockSummary);
    const { result } = renderHook(() => useUtilizationSummary());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockSummary);
  });
});

describe('Given usePeopleEvents hook', () => {
  it('When API resolves / Then events data is returned', async () => {
    const mockData = { data: [{ id: 'ev1', event_type: 'person_created' }], total: 1 };
    mockEventsApi.getAll.mockResolvedValue(mockData);
    const { result } = renderHook(() => usePeopleEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockData);
  });
});
