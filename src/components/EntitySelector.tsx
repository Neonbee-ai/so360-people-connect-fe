import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Combobox } from '@so360/design-system';
import { entitiesApi } from '../services/peopleService';
import type { EntityOption, LookupEntityType } from '../types/people';

// Plural display labels for the empty state (so "opportunity" doesn't render
// as "opportunitys").
const ENTITY_PLURALS: Record<LookupEntityType, string> = {
    project: 'projects',
    task: 'tasks',
    deal: 'deals',
    opportunity: 'opportunities',
    lead: 'leads',
    customer: 'customers',
    department: 'departments',
};

// =============================================================================
// EntitySelector — UUID-safe execution entity picker
//
// Replaces free-text "Entity ID (UUID)" entry across Time Entries and
// Allocations. The user picks a project / deal (or a task within a project)
// from a searchable dropdown sourced from the sibling services; the selected
// option's real UUID is stored internally and surfaced via onChange. Users
// never see or type a UUID.
// =============================================================================

interface EntityComboProps {
    type: LookupEntityType;
    projectId?: string;           // required when type === 'task'
    value: string;                // selected entity UUID ('' when none)
    displayName?: string;         // selected entity name (for the closed label)
    onSelect: (option: EntityOption | null) => void;
    disabled?: boolean;
    error?: boolean;
    placeholder?: string;
}

const EntityCombo: React.FC<EntityComboProps> = ({
    type, projectId, value, displayName, onSelect, disabled, error, placeholder,
}) => {
    // Options from the unfiltered prefetch; used to resolve the selected label while the list is closed.
    const [prefetched, setPrefetched] = useState<EntityOption[]>([]);
    // Tasks can only be listed once a project is chosen.
    const ready = type !== 'task' || !!projectId;
    const [loadError, setLoadError] = useState(false);
    // Every option seen so far, keyed by id, so onChange can hand back the full EntityOption.
    const seenRef = useRef<Map<string, EntityOption>>(new Map());
    // Prevents state updates on an unmounted component (e.g. modal closed while loading).
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
    // Monotonic counter: only the newest prefetch may commit, so a slow response for a
    // previous entity type can never overwrite fresh results after the type changes.
    const requestIdRef = useRef(0);

    // Fetch options from the lookup proxy. `search` is forwarded to the backend.
    const fetchOptions = useCallback(async (search: string): Promise<EntityOption[]> => {
        const res = await entitiesApi.list({
            type,
            project_id: projectId,
            ...(search ? { search } : {}),
        });
        const data: EntityOption[] = res.data || [];
        data.forEach((o) => seenRef.current.set(o.id, o));
        return data;
    }, [type, projectId]);

    // Combobox calls this (debounced) on open and as the user types.
    const loadOptions = useCallback(async (query: string) => {
        if (!ready) return [];
        try {
            const data = await fetchOptions(query.trim());
            if (isMounted.current) setLoadError(false);
            return data.map((o) => ({ value: o.id, label: o.name }));
        } catch {
            if (isMounted.current) setLoadError(true);
            return [];
        }
    }, [ready, fetchOptions]);

    // Prefetch on mount / key change so a stored selection resolves to its name.
    useEffect(() => {
        seenRef.current = new Map();
        setPrefetched([]);
        setLoadError(false);
        if (!ready) return;
        const reqId = ++requestIdRef.current;
        fetchOptions('')
            .then((data) => {
                if (isMounted.current && requestIdRef.current === reqId) setPrefetched(data);
            })
            .catch(() => {
                if (isMounted.current && requestIdRef.current === reqId) setLoadError(true);
            });
    }, [ready, fetchOptions]);

    const comboOptions = useMemo(() => {
        const mapped = prefetched.map((o) => ({ value: o.id, label: o.name }));
        // Fall back to the stored display name if the selected row isn't in the prefetch.
        if (value && displayName && !mapped.some((o) => o.value === value)) {
            mapped.unshift({ value, label: displayName });
        }
        return mapped;
    }, [prefetched, value, displayName]);

    // comb-exception: Comb Combobox has no in-list retry action, so the former "click the error to
    // retry" row is now an error message; re-opening the field re-fetches.
    const emptyText = !ready
        ? 'Select a project first'
        : loadError
            ? 'Unable to load records. Please try again.'
            : `No ${ENTITY_PLURALS[type]} found`;

    return (
        <Combobox
            name={`entity-${type}`}
            aria-label={placeholder || `Select ${type}`}
            options={comboOptions}
            value={value || null}
            placeholder={placeholder || 'Select...'}
            disabled={disabled}
            error={error ? 'Invalid selection' : undefined}
            emptyText={emptyText}
            loadOptions={loadOptions}
            debounceMs={300}
            onChange={(id) => onSelect(id ? seenRef.current.get(id) ?? { id, name: '' } as EntityOption : null)}
        />
    );
};

interface EntitySelectorProps {
    entityType: LookupEntityType;
    value: string;                // selected entity UUID
    displayName?: string;         // selected entity name
    onChange: (option: EntityOption | null) => void;
    disabled?: boolean;
    error?: boolean;
}

/**
 * Picks an execution entity for the given type. For `task`, renders a cascading
 * project → task pair (tasks are scoped to a project); for `project`/`deal`,
 * renders a single dropdown. Always emits the chosen option's real UUID.
 */
const EntitySelector: React.FC<EntitySelectorProps> = ({
    entityType, value, displayName, onChange, disabled, error,
}) => {
    // Internal project context, used only when picking a task.
    const [taskProject, setTaskProject] = useState<EntityOption | null>(null);

    // Reset the cascading project whenever we leave task mode.
    useEffect(() => {
        if (entityType !== 'task') setTaskProject(null);
    }, [entityType]);

    if (entityType === 'task') {
        return (
            <div className="space-y-2">
                <EntityCombo
                    type="project"
                    value={taskProject?.id || ''}
                    displayName={taskProject?.name}
                    onSelect={(opt) => {
                        setTaskProject(opt);
                        onChange(null); // clear the task when the project changes
                    }}
                    disabled={disabled}
                    placeholder="Select project..."
                />
                <EntityCombo
                    type="task"
                    projectId={taskProject?.id}
                    value={value}
                    displayName={displayName}
                    onSelect={onChange}
                    disabled={disabled || !taskProject}
                    error={error}
                    placeholder="Select task..."
                />
            </div>
        );
    }

    return (
        <EntityCombo
            type={entityType}
            value={value}
            displayName={displayName}
            onSelect={onChange}
            disabled={disabled}
            error={error}
            placeholder={`Select ${entityType}...`}
        />
    );
};

export default EntitySelector;
