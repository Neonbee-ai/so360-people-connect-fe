import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Minimal shape a pickable option must satisfy. Deliberately structural rather
 * than tied to `Person` so the same control can drive a restricted list (e.g.
 * eligible reviewers) as well as a plain people lookup.
 */
export interface PickablePerson {
    id: string;
    full_name: string;
    job_title?: string;
}

export interface PersonPickerProps<T extends PickablePerson = PickablePerson> {
    /** Full candidate list. Filtering happens in the browser. */
    options: T[];
    /** Currently selected person id, or '' when nothing is selected. */
    value: string;
    onChange: (personId: string, person?: T) => void;
    placeholder?: string;
    /** Rendered in place of the list when `options` is empty. */
    emptyMessage?: string;
    /** Suppresses the list and greys the field (e.g. prerequisites unmet). */
    disabled?: boolean;
    disabledMessage?: string;
    loading?: boolean;
    /** Max rows rendered at once; the list scrolls beyond this. */
    maxVisible?: number;
    inputId?: string;
    'data-testid'?: string;
}

/**
 * Searchable person selector used across People Connect forms.
 *
 * Replaces the copy-pasted "type a character before anything appears" inputs
 * that previously lived inline in the Reviews and Feedback modals: the list now
 * opens on focus/click showing every available person, typing filters it, and
 * clearing the text restores the full list. Selection is confirmed with an
 * explicit Clear control — the field itself never edits the underlying person
 * record.
 */
function PersonPicker<T extends PickablePerson = PickablePerson>({
    options,
    value,
    onChange,
    placeholder = 'Search people...',
    emptyMessage = 'No people available',
    disabled = false,
    disabledMessage,
    loading = false,
    maxVisible = 10,
    inputId,
    'data-testid': testId,
}: PersonPickerProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = options.find(p => p.id === value);

    // Close on outside click so the list never strands over the rest of the form.
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // A selection made elsewhere (or cleared upstream) must not leave a stale
    // search term behind that would filter the list on next open.
    useEffect(() => {
        if (value) {
            setSearch('');
            setIsOpen(false);
        }
    }, [value]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return options;
        return options.filter(p => p.full_name?.toLowerCase().includes(term));
    }, [options, search]);

    if (selected) {
        return (
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg" data-testid={testId}>
                <span className="text-sm text-slate-50">{selected.full_name}</span>
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="text-xs text-slate-400 hover:text-red-400"
                >
                    Clear
                </button>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative" data-testid={testId}>
            <input
                id={inputId}
                type="text"
                autoComplete="off"
                placeholder={placeholder}
                value={search}
                disabled={disabled}
                onFocus={() => !disabled && setIsOpen(true)}
                onClick={() => !disabled && setIsOpen(true)}
                onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {disabled && disabledMessage && (
                <p className="mt-1 text-xs text-slate-500">{disabledMessage}</p>
            )}

            {isOpen && !disabled && (
                <div className="mt-1 max-h-40 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg">
                    {loading ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Loading…</p>
                    ) : filtered.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">
                            {options.length === 0 ? emptyMessage : 'No matches found'}
                        </p>
                    ) : (
                        filtered.slice(0, maxVisible).map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => { onChange(p.id, p); setSearch(''); setIsOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-50"
                            >
                                {p.full_name} {p.job_title ? `(${p.job_title})` : ''}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default PersonPicker;
