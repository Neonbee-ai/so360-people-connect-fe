import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { toast, Select, Button, TextField, Stack } from '@so360/design-system';
import { workLocationsApi, WorkLocation } from '../../services/workLocationsService';

/**
 * The "Manage Work Locations" link leaves this form for a different page, which
 * silently discards anything already typed. Rather than stack a confirm modal
 * on top of the person modal, the warning replaces this line in place: one tap
 * to leave, one to stay. A pristine form navigates straight through, since
 * there is nothing to lose.
 */
export const WorkLocationFieldHelp: React.FC<{
    hasError: boolean;
    isEmpty: boolean;
    isDirty: boolean;
    /**
     * When provided, offers an in-drawer quick-add that replaces the drawer
     * content (no navigation, nothing typed is at risk). The full management
     * page link stays for heavier work.
     */
    onQuickAdd?: () => void;
}> = ({ hasError, isEmpty, isDirty, onQuickAdd }) => {
    const navigate = useNavigate();
    const [confirmingLeave, setConfirmingLeave] = useState(false);

    const go = () => navigate('/people/settings/work-locations');

    if (confirmingLeave) {
        return (
            <p className="text-nb-caption text-warning">
                Leaving discards what you&apos;ve entered.{' '}
                <Button variant="ghost" size="sm" onClick={go}>Leave anyway</Button>
                {' · '}
                <Button variant="ghost" size="sm" onClick={() => setConfirmingLeave(false)}>Stay</Button>
            </p>
        );
    }

    return (
        <p className="text-nb-caption text-fg-subtle">
            {hasError
                ? <span className="text-danger">Couldn&apos;t load work locations. </span>
                : isEmpty
                    ? 'No work locations configured. '
                    : null}
            {onQuickAdd && (
                <>
                    <Button variant="ghost" size="sm" onClick={onQuickAdd}>+ New Location</Button>
                    {' · '}
                </>
            )}
            <Button variant="ghost" size="sm" onClick={() => (isDirty ? setConfirmingLeave(true) : go())}>
                Manage Work Locations
            </Button>
        </p>
    );
};

// =============================================================================
// Collapsible form section — progressive disclosure (UX guide: complete the
// common task with a handful of fields; everything else behind Advanced).
// =============================================================================

export const Section: React.FC<{
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}> = ({ title, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    // No Collapsible exists in the DS yet: token-only disclosure built on Button.
    return (
        <div className="border border-line rounded-nb">
            <Button
                variant="ghost"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
            >
                <span className="text-nb-label text-fg-muted">{title}</span>
                <ChevronDown size={14} className={`text-fg-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
            {open && <div className="px-nb-4 pb-nb-4"><Stack gap="region">{children}</Stack></div>}
        </div>
    );
};

// =============================================================================
// Quick-add Work Location panel — replaces the person drawer's content (never
// stacks a second surface); Back returns to the form with the new location
// selected.
// =============================================================================

export const QuickAddLocationPanel: React.FC<{
    onCreated: (loc: WorkLocation) => void;
}> = ({ onCreated }) => {
    const [name, setName] = useState('');
    const [locationType, setLocationType] = useState<'office' | 'factory' | 'store' | 'remote'>('office');
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        try {
            const loc = await workLocationsApi.create({ name: name.trim(), location_type: locationType });
            toast.success(`Work location "${loc.name}" created`);
            onCreated(loc);
        } catch (err) {
            toast.error((err as Error)?.message || 'Failed to create work location');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form id="quick-add-location-form" onSubmit={handleSubmit}>
            <Stack gap="default">
                <TextField
                    name="quick-location-name"
                    label="Name"
                    required
                    autoFocus
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder="e.g. Main Factory, Head Office"
                />
                <Select label="Type" name="quick-location-type" id="quick-location-type" value={locationType} onChange={e => setLocationType(e.target.value as typeof locationType)} options={[{ value: "office", label: "Office" }, { value: "factory", label: "Factory" }, { value: "store", label: "Store" }, { value: "remote", label: "Remote" }]} />
                <p className="text-nb-caption text-fg-subtle">
                    Address and status can be set later from Work Locations.
                </p>
            </Stack>
        </form>
    );
};
