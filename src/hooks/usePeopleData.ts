import { useState, useEffect, useCallback } from 'react';
import { peopleApi, allocationsApi, timeEntriesApi, utilizationApi, eventsApi } from '../services/peopleService';
import type {
    Person, Allocation, TimeEntry, UtilizationData,
    UtilizationSummary, PeopleEvent, PaginatedResponse,
} from '../types/people';

/**
 * Generic data fetching hook with loading, error, and refresh capabilities.
 */
function useAsyncData<T>(
    fetcher: () => Promise<T>,
    deps: unknown[] = []
) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await fetcher();
            setData(result);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An error occurred';
            setError(message);
            console.error('Data fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, deps);

    useEffect(() => {
        load();
    }, [load]);

    return { data, loading, error, refresh: load, setData };
}

/**
 * Hook for loading people list with filters.
 */
export function usePeopleList(params?: { status?: string; type?: string; search?: string; page?: number; limit?: number }) {
    return useAsyncData<PaginatedResponse<Person>>(
        () => peopleApi.getAll(params),
        [params?.status, params?.type, params?.search, params?.page, params?.limit]
    );
}

/**
 * Hook for loading a single person by ID.
 */
export function usePersonDetail(id: string | undefined) {
    return useAsyncData<Person>(
        () => {
            if (!id) throw new Error('No person ID');
            return peopleApi.getById(id);
        },
        [id]
    );
}

/**
 * Hook for loading allocations with filters.
 */
export function useAllocations(params?: { person_id?: string; entity_id?: string; entity_type?: string; status?: string; page?: number; limit?: number }) {
    return useAsyncData<PaginatedResponse<Allocation>>(
        () => allocationsApi.getAll(params),
        [params?.person_id, params?.entity_id, params?.entity_type, params?.status, params?.page, params?.limit]
    );
}

/**
 * Hook for loading time entries with filters.
 */
export function useTimeEntries(params?: { person_id?: string; entity_id?: string; status?: string; from_date?: string; to_date?: string; page?: number; limit?: number }) {
    return useAsyncData<PaginatedResponse<TimeEntry>>(
        () => timeEntriesApi.getAll(params),
        [params?.person_id, params?.entity_id, params?.status, params?.from_date, params?.to_date, params?.page, params?.limit]
    );
}

/**
 * Hook for loading utilization data.
 */
export function useUtilization(params?: { period_start?: string; period_end?: string; person_id?: string }) {
    return useAsyncData<{ data: UtilizationData[]; period: { start: string; end: string } }>(
        () => utilizationApi.getAll(params),
        [params?.period_start, params?.period_end, params?.person_id]
    );
}

/**
 * Hook for loading utilization summary.
 */
export function useUtilizationSummary() {
    return useAsyncData<UtilizationSummary>(
        () => utilizationApi.getSummary(),
        []
    );
}

/**
 * Hook for loading people events.
 */
export function usePeopleEvents(params?: { person_id?: string; event_type?: string; page?: number; limit?: number }) {
    return useAsyncData<PaginatedResponse<PeopleEvent>>(
        () => eventsApi.getAll(params),
        [params?.person_id, params?.event_type, params?.page, params?.limit]
    );
}
