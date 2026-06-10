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
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Tasks can only be listed once a project is chosen.
    const ready = type !== 'task' || !!projectId;

    const load = useCallback(() => {
        if (!ready) {
            setOptions([]);
            return;
        }
        setLoading(true);
        setLoadError(false);
        entitiesApi.list({ type, project_id: projectId })
            .then((res) => setOptions(res.data || []))
            .catch(() => { setOptions([]); setLoadError(true); })
            .finally(() => setLoading(false));
    }, [type, projectId, ready]);

    // (Re)load whenever the lookup key changes.
    useEffect(() => { load(); }, [load]);

    const selected = useMemo(
        () => options.find((o) => o.id === value),
        [options, value],
    );
    // Fall back to the stored display name if options haven't loaded yet.
    const selectedLabel = selected?.name || (value ? displayName : '') || '';

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
                            Couldn't load — tap to retry
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
