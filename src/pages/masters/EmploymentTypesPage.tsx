import React, { useEffect, useState } from 'react';
import { Briefcase, CalendarDays } from 'lucide-react';
import MasterListPage from '../../components/MasterListPage';
import Modal from '../../components/Modal';
import { useCanConfigureLeave } from '../../hooks/useCanConfigureLeave';
import { Button, Checkbox, Cluster, IconButton, Spinner, Stack, TextField } from '@so360/design-system';
import { leaveConfigApi } from '../../services/leaveConfigService';
import { leaveTypesApi, type LeaveType } from '../../services/leaveTypesService';

interface LeaveTypesModalProps {
    masterId: string;
    masterName: string;
    onClose: () => void;
}

/**
 * Which leave types employees under this employment type receive by default.
 *
 * References the central Leave Type master — this screen never creates leave
 * types, and the entitlement/accrual rules stay on the Leave Type itself.
 * Employment Type answers one question only: WHICH types apply.
 */
const EmploymentTypeLeaveTypesModal: React.FC<LeaveTypesModalProps> = ({
    masterId,
    masterName,
    onClose,
}) => {
    const [allTypes, setAllTypes] = useState<LeaveType[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [configured, setConfigured] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [catalog, config] = await Promise.all([
                    leaveTypesApi.getAll({ is_active: true }),
                    leaveConfigApi.getForEmploymentType(masterId),
                ]);
                if (cancelled) return;
                setAllTypes(catalog.data ?? []);
                setSelected(new Set(config.leave_types.map((t) => t.id)));
                setConfigured(config.configured);
            } catch {
                if (!cancelled) setError('Could not load leave types.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [masterId]);

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            await leaveConfigApi.setForEmploymentType(masterId, Array.from(selected));
            onClose();
        } catch (err) {
            // Keep the user's selections on screen — making them re-pick after a
            // failed save is how a transient error turns into lost work. Surface
            // the server's reason when it gave one so the failure is diagnosable.
            const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
            setError(`Could not save${detail}. Your selection has been kept — try again.`);
        } finally {
            setSaving(false);
        }
    };

    const visible = allTypes.filter((t) =>
        t.name.toLowerCase().includes(search.trim().toLowerCase()),
    );

    return (
        <Modal isOpen onClose={onClose} title={`Leave Types — ${masterName}`}>
            <Stack gap="default">
                <p className="text-nb-caption text-fg-muted">
                    Select the leave types employees under this employment type should receive by
                    default. Employees with their own configuration keep it.
                </p>

                {loading ? (
                    <Cluster>
                        <Spinner size="sm" /> <span className="text-nb-sm text-fg-muted">Loading…</span>
                    </Cluster>
                ) : (
                    <>
                        {/* Selecting nothing is a real choice with a real consequence —
                            say what it is rather than letting HR discover it later. */}
                        {selected.size === 0 && (
                            <p className="text-nb-caption text-warning">
                                {configured
                                    ? 'Saving with none selected resets this employment type to unconfigured — every active leave type will apply again.'
                                    : 'This employment type is not configured, so every active leave type applies to its employees.'}
                            </p>
                        )}

                        {allTypes.length > 8 && (
                            <TextField
                                name="leave-type-search"
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search leave types"
                                aria-label="Search leave types"
                            />
                        )}

                        <div className="max-h-72 overflow-y-auto border border-line rounded-nb divide-y divide-line">
                            {visible.length === 0 ? (
                                <p className="px-nb-3 py-nb-4 text-nb-sm text-fg-subtle">
                                    No leave types found. Create them under Leave Types first.
                                </p>
                            ) : (
                                visible.map((type) => (
                                    <Cluster key={type.id} justify="between" className="px-nb-3 py-nb-2">
                                        <Checkbox
                                            name={`leave-type-${type.id}`}
                                            label={type.name}
                                            checked={selected.has(type.id)}
                                            onChange={() => toggle(type.id)}
                                        />
                                        <span className="text-nb-caption text-fg-subtle">
                                            {type.is_paid ? 'Paid' : 'Unpaid'}
                                            {type.max_days_per_year != null
                                                ? ` · ${type.max_days_per_year} days/yr`
                                                : ''}
                                        </span>
                                    </Cluster>
                                ))
                            )}
                        </div>

                        {error && (
                            <p role="alert" className="text-nb-caption text-danger">
                                {error}
                            </p>
                        )}

                        <Cluster justify="between">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                                Clear selection
                            </Button>
                            <Cluster>
                                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
                                    {saving ? 'Saving…' : 'Save'}
                                </Button>
                            </Cluster>
                        </Cluster>
                    </>
                )}
            </Stack>
        </Modal>
    );
};

const EmploymentTypesPage: React.FC = () => {
    const [editingLeave, setEditingLeave] = useState<{ id: string; name: string } | null>(null);
    // The modal writes leave config (leave.update on the BE); hide the entry point
    // from users who would only hit a 403 on save.
    const canConfigureLeave = useCanConfigureLeave();

    return (
        <>
            <MasterListPage
                masterType="employment_type"
                label="Employment Type"
                showContractorFlag
                icon={Briefcase}
                description="Full Time, Part Time, Contract, and other employment arrangements"
                rowExtraAction={canConfigureLeave ? (row) => (
                    <IconButton
                        label={`Configure leave types for ${row.name}`}
                        icon={<CalendarDays size={14} />}
                        size="sm"
                        onClick={() => setEditingLeave({ id: row.id, name: row.name })}
                    />
                ) : undefined}
            />
            {editingLeave && (
                <EmploymentTypeLeaveTypesModal
                    masterId={editingLeave.id}
                    masterName={editingLeave.name}
                    onClose={() => setEditingLeave(null)}
                />
            )}
        </>
    );
};

export default EmploymentTypesPage;
