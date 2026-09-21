import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
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
    const [options, setOptions] = useState<EntityOption[]>([]);
    // Tasks can only be listed once a project is chosen.
    const ready = type !== 'task' || !!projectId;
    // Start in loading state when ready so the dropdown shows "Loading..." instead
    // of "No records found" on the first render before the first fetch completes.
    const [loading, setLoading] = useState(ready);
    const [loadError, setLoadError] = useState(false);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    // Debounced search term sent to the backend (300 ms lag after user input).
    const [serverSearch, setServerSearch] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // Prevents state updates on an unmounted component (e.g. modal closed while loading).
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
    // Monotonically increasing counter — each load() call captures the current
    // value before going async. The .then() only commits results if the counter
    // hasn't advanced (i.e. no newer load() was started since this one began).
    // This prevents stale responses from a previous entity type overwriting fresh
    // results when the user changes the type while a request is still in-flight.
    const requestIdRef = useRef(0);

    // Propagate local search → serverSearch after a short debounce so we don't
    // fire a backend request on every keystroke.
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setServerSearch(search), 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    const load = useCallback(() => {
        if (!ready) {
            setOptions([]);
            setLoading(false);
            return;
        }
        // Clear stale options from a previous type immediately so the dropdown
        // never shows e.g. project names while leads are loading.
        setOptions([]);
        setLoading(true);
        setLoadError(false);
        // Stamp this request so we can discard results from superseded calls.
        const reqId = ++requestIdRef.current;
        entitiesApi.list({
            type,
            project_id: projectId,
            ...(serverSearch ? { search: serverSearch } : {}),
        })
            .then((res) => {
                if (isMounted.current && requestIdRef.current === reqId) {
                    setOptions(res.data || []);
                }
            })
            .catch(() => {
                if (isMounted.current && requestIdRef.current === reqId) {
                    setOptions([]);
                    setLoadError(true);
                }
            })
            .finally(() => {
                if (isMounted.current && requestIdRef.current === reqId) {
                    setLoading(false);
                }
            });
    }, [type, projectId, ready, serverSearch]);

    // (Re)load whenever the lookup key or debounced search changes.
    useEffect(() => { load(); }, [load]);

    const selected = useMemo(
        () => options.find((o) => o.id === value),
        [options, value],
    );
    // Fall back to the stored display name if options haven't loaded yet.
    const selectedLabel = selected?.name || (value ? displayName : '') || '';

    // Client-side filter provides immediate feedback while the debounce is
    // pending; once the server returns, options itself is already filtered.
    const filtered = useMemo(() => {
        if (!search) return options;
        const lower = search.toLowerCase();
        return options.filter((o) => o.name.toLowerCase().includes(lower));
    }, [options, search]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (option: EntityOption) => {
        onSelect(option);
        setOpen(false);
        setSearch('');
    };

    const borderClass = error
        ? 'border-rose-500 focus-within:border-rose-500'
        : 'border-slate-700 focus-within:border-teal-500';

    return (
        <div ref={containerRef} className="relative">
            <div
                className={`flex items-center w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 ${borderClass} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => {
                    if (disabled) return;
                    const next = !open;
                    setOpen(next);
                    if (next) setTimeout(() => inputRef.current?.focus(), 0);
                }}
            >
                {open ? (
                    <>
                        <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                        <input
                            ref={inputRef}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={selectedLabel || placeholder || 'Search...'}
                            className="flex-1 bg-transparent outline-none text-sm text-slate-50 placeholder-slate-400"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </>
                ) : (
                    <span className={`flex-1 truncate ${selectedLabel ? 'text-slate-50' : 'text-slate-400'}`}>
                        {selectedLabel || placeholder || 'Select...'}
                    </span>
                )}
                {open
                    ? <ChevronUp size={16} className="ml-2 text-slate-400 shrink-0" />
                    : <ChevronDown size={16} className="ml-2 text-slate-400 shrink-0" />}
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
                    {!ready ? (
                        <div className="px-3 py-2 text-sm text-slate-400">Select a project first</div>
                    ) : loading ? (
                        <div className="px-3 py-2 text-sm text-slate-400">Loading...</div>
                    ) : loadError ? (
                        <button type="button" onClick={load} className="w-full text-left px-3 py-2 text-sm text-rose-400 hover:bg-slate-700">
                            Unable to load records. Please try again.
                        </button>
                    ) : filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-400">No {ENTITY_PLURALS[type]} found</div>
                    ) : (
                        filtered.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => handleSelect(option)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center ${option.id === value ? 'bg-slate-700/50 text-teal-400' : 'text-slate-50'}`}
                            >
                                <span className="truncate">{option.name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
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
