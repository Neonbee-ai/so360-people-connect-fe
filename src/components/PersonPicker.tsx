import React, { useMemo } from 'react';
import { Combobox } from '@so360/design-system';

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
    /**
     * Retained for API compatibility. Comb Combobox owns list sizing and scrolls
     * internally, so this no longer truncates the rendered rows.
     */
    maxVisible?: number;
    inputId?: string;
    'data-testid'?: string;
}

/**
 * Searchable person selector used across People Connect forms, built on Comb
 * Combobox. The list opens on focus/click showing every available person,
 * typing filters it by name, and the clear control empties the selection. The
 * field never edits the underlying person record.
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
    inputId,
    'data-testid': testId,
}: PersonPickerProps<T>) {
    const comboOptions = useMemo(
        () => options.map(p => ({ value: p.id, label: p.full_name, description: p.job_title })),
        [options],
    );

    const emptyText = loading ? 'Loading…' : options.length === 0 ? emptyMessage : 'No matches found';

    return (
        <div data-testid={testId}>
            <Combobox
                name={inputId ?? 'person-picker'}
                id={inputId}
                aria-label="Person"
                options={comboOptions}
                value={value || null}
                placeholder={placeholder}
                disabled={disabled}
                clearable
                emptyText={emptyText}
                filter={(o: { label: string }, q: string) => o.label.toLowerCase().includes(q.trim().toLowerCase())}
                onChange={(id: string | null) => {
                    if (!id) {
                        onChange('');
                        return;
                    }
                    onChange(id, options.find(p => p.id === id));
                }}
            />
            {disabled && disabledMessage && (
                <p className="mt-1 text-nb-caption text-fg-subtle">{disabledMessage}</p>
            )}
        </div>
    );
}

export default PersonPicker;
