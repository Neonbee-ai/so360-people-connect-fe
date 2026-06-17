import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: { getAll: vi.fn(), getById: vi.fn() },
  allocationsApi: { getAll: vi.fn() },
  utilizationApi: { getAll: vi.fn(), getSummary: vi.fn() },
  eventsApi: { getAll: vi.fn() },
}));

import { usePeopleList, usePersonDetail, useAllocations, useUtilization, useUtilizationSummary, usePeopleEvents } from '../hooks/usePeopleData';
import { peopleApi, allocationsApi, utilizationApi, eventsApi } from '../services/peopleService';

const mockPeople = peopleApi as any;
const mockAlloc = allocationsApi as any;
const mockUtil = utilizationApi as any;
const mockEvents = eventsApi as any;

beforeEach(() => vi.resetAllMocks());

describe('usePeopleList', () => {
  describe('Given the API returns data', () => {
    it('When the hook is rendered / Then it returns the data', async () => {
      mockPeople.getAll.mockResolvedValue({ data: [{ id: 'p1' }], meta: { total: 1 } });
      const { result } = renderHook(() => usePeopleList({ status: 'active' }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data?.data).toHaveLength(1);
    });
  });

  describe('Given the API fails', () => {
    it('When the hook is rendered / Then it returns an error', async () => {
      mockPeople.getAll.mockImplementation(async () => { throw new Error('fail'); });
      const { result } = renderHook(() => usePeopleList());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe('fail');
    });
  });
});

describe('usePersonDetail', () => {
  describe('Given a valid ID', () => {
    it('When the hook is rendered / Then it fetches the person', async () => {
      mockPeople.getById.mockResolvedValue({ id: 'p1', full_name: 'Alice' });
      const { result } = renderHook(() => usePersonDetail('p1'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data?.full_name).toBe('Alice');
    });
  });

  describe('Given no ID', () => {
    it('When the hook is rendered / Then it returns an error', async () => {
      const { result } = renderHook(() => usePersonDetail(undefined));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe('No person ID');
    });
  });
});

describe('useAllocations', () => {
  it('Given the API returns data / When rendered / Then it returns allocations', async () => {
    mockAlloc.getAll.mockResolvedValue({ data: [{ id: 'a1' }], meta: { total: 1 } });
    const { result } = renderHook(() => useAllocations({ person_id: 'p1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.data).toHaveLength(1);
  });
});

// useTimeEntries specs removed — hook deleted with the Timesheets consolidation.

describe('useUtilization', () => {
  it('Given the API returns data / When rendered / Then it returns utilization', async () => {
    mockUtil.getAll.mockResolvedValue({ data: [], period: { start: '', end: '' } });
    const { result } = renderHook(() => useUtilization({ period_start: '2025-01-01' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeDefined();
  });
});

describe('useUtilizationSummary', () => {
  it('Given the API returns data / When rendered / Then it returns summary', async () => {
    mockUtil.getSummary.mockResolvedValue({ total_people: 10 });
    const { result } = renderHook(() => useUtilizationSummary());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.total_people).toBe(10);
  });
});

describe('usePeopleEvents', () => {
  it('Given the API returns data / When rendered / Then it returns events', async () => {
    mockEvents.getAll.mockResolvedValue({ data: [{ id: 'e1' }], meta: { total: 1 } });
    const { result } = renderHook(() => usePeopleEvents({ event_type: 'person_created' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.data).toHaveLength(1);
  });
});

describe('useShellContext', () => {
  it('Given ShellContext has a value / When used / Then it returns context', async () => {
    const { ShellContext } = await import('@so360/shell-context');
    const { useShellContext } = await import('../hooks/useShellContext');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(ShellContext.Provider, {
        value: {
          user: { id: 'u1', email: 'test@test.com', full_name: 'Test' },
          currentTenant: { id: 't1', name: 'Tenant' },
          currentOrg: { id: 'o1', name: 'Org' },
          accessToken: 'tok',
          isLoading: false,
          error: null,
          tenants: [],
          orgs: [],
          refreshContext: vi.fn(),
        },
      } as any, children);

    const { result } = renderHook(() => useShellContext(), { wrapper });
    expect(result.current.user.id).toBe('u1');
    expect(result.current.currentTenant.id).toBe('t1');
  });
});

describe('usePeopleContext', () => {
  it('Given ShellContext has a value / When used / Then it returns derived values', async () => {
    const { ShellContext } = await import('@so360/shell-context');
    const { usePeopleContext } = await import('../hooks/useShellContext');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(ShellContext.Provider, {
        value: {
          user: { id: 'u1', email: 'test@test.com', full_name: 'Test User' },
          currentTenant: { id: 't1', name: 'Tenant' },
          currentOrg: { id: 'o1', name: 'Org' },
          accessToken: 'tok',
          isLoading: false,
          error: null,
          tenants: [],
          orgs: [],
          refreshContext: vi.fn(),
        },
      } as any, children);

    const { result } = renderHook(() => usePeopleContext(), { wrapper });
    expect(result.current.tenantId).toBe('t1');
    expect(result.current.orgId).toBe('o1');
    expect(result.current.userId).toBe('u1');
    expect(result.current.userName).toBe('Test User');
    expect(result.current.isReady).toBe(true);
  });
});
