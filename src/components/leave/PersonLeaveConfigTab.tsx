import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, RotateCcw, X } from 'lucide-react';
import { Badge, Button, IconButton, Spinner, Stack, Cluster } from '@so360/design-system';
import {
    leaveConfigApi,
    type ApplicableLeaveType,
    type PersonLeaveConfig,
} from '../../services/leaveConfigService';
import { leaveTypesApi, type LeaveType } from '../../services/leaveTypesService';

interface Props {
    personId: string;
    /** Employment type name, for copy that explains where inheritance comes from. */
    employmentTypeLabel?: string | null;
    /** HR/Admin only. Read-only viewers still see the configuration, just not the controls. */
    canEdit?: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
    employment_type: 'Employment Type',
    employee: 'Employee-specific',
    org_default: 'All types (not configured)',
};

const SOURCE_TONE: Record<string, 'neutral' | 'primary'> = {
    employment_type: 'neutral',
    employee: 'primary',
    org_default: 'neutral',
};

/**
 * Employee Profile → Leave. The single place HR can see WHY a leave type is
 * available to this person — inherited from their employment type, or configured
 * for them specifically — and change it without touching anyone else.
 *
 * Removal is hide-only: withholding a type stops it appearing in new requests and
 * stops it accruing, but existing balances and approved history are untouched.
 */
const PersonLeaveConfigTab: React.FC<Props> = ({
    personId,
    employmentTypeLabel,
    canEdit = false,
}) => {
    const [config, setConfig] = useState<PersonLeaveConfig | null>(null);
    const [allTypes, setAllTypes] = useState<LeaveType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [resolved, catalog] = await Promise.all([
                leaveConfigApi.getForPerson(personId),
                leaveTypesApi.getAll({ is_active: true }),
            ]);
            setConfig(resolved);
            setAllTypes(catalog.data ?? []);
        } catch {
            // Distinct from "nothing configured" — an unreadable configuration must
            // never render as an empty allow-list.
            setError('Could not load this employee’s leave configuration.');
        } finally {
            setLoading(false);
        }
    }, [personId]);

    useEffect(() => {
        void load();
    }, [load]);

    const apply = async (
        leaveTypeId: string,
        action: () => Promise<PersonLeaveConfig>,
        message: string,
    ) => {
        setSavingId(leaveTypeId);
        setError(null);
        try {
            setConfig(await action());
            setNotice(message);
        } catch {
            // Keep the previous state visible rather than painting a half-applied
            // configuration the server never accepted.
            setError('Could not save that change. The configuration is unchanged.');
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return (
            <Cluster gap="tight" className="p-nb-4 text-nb-body text-fg-muted">
                <Spinner />
                Loading leave configuration…
            </Cluster>
        );
    }

    if (error && !config) {
        return (
            <Stack gap="tight" className="p-nb-4">
                <p role="alert" className="text-nb-body text-danger">{error}</p>
                <div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
                        Retry
                    </Button>
                </div>
            </Stack>
        );
    }

    if (!config) return null;

    const assignedIds = new Set(config.leave_types.map((t) => t.id));
    const excludedIds = new Set(config.excluded.map((t) => t.id));
    const addable = allTypes.filter((t) => !assignedIds.has(t.id) && !excludedIds.has(t.id));

    const row = (type: ApplicableLeaveType, withheld: boolean) => (
        <div
            key={type.id}
            className="flex items-center justify-between gap-nb-3 p-nb-3 border-b border-line last:border-0"
        >
            <div className="min-w-0">
                <p className={`text-nb-body ${withheld ? 'text-fg-subtle line-through' : 'text-fg'}`}>
                    {type.name}
                </p>
                {type.max_days_per_year != null && !withheld && (
                    <p className="text-nb-caption text-fg-subtle">{type.max_days_per_year} days/year</p>
                )}
            </div>
            <Cluster gap="tight" className="shrink-0">
                <Badge tone={withheld ? 'danger' : SOURCE_TONE[type.source] ?? 'neutral'} size="sm">
                    {withheld ? 'Withheld' : SOURCE_LABEL[type.source]}
                </Badge>
                {canEdit && savingId === type.id && <Spinner />}
                {canEdit && savingId !== type.id && withheld && (
                    <IconButton
                        label={`Restore ${type.name}`}
                        variant="ghost"
                        size="sm"
                        icon={<RotateCcw size={16} />}
                        onClick={() =>
                            void apply(
                                type.id,
                                () => leaveConfigApi.clearPersonOverride(personId, type.id),
                                `${type.name} restored.`,
                            )
                        }
                    />
                )}
                {canEdit && savingId !== type.id && !withheld && (
                    <IconButton
                        label={`Remove ${type.name}`}
                        variant="ghost"
                        size="sm"
                        icon={<X size={16} />}
                        onClick={() =>
                            void apply(
                                type.id,
                                () => leaveConfigApi.setPersonOverride(personId, type.id, 'exclude'),
                                `${type.name} withheld from this employee.`,
                            )
                        }
                    />
                )}
            </Cluster>
        </div>
    );

    return (
        <Stack gap="default">
            <div>
                <h3 className="text-nb-label text-fg">Leave Configuration</h3>
                <p className="text-nb-caption text-fg-subtle mt-nb-1">
                    {config.inherits_all ? (
                        <>
                            {employmentTypeLabel ?? config.employment_type ?? 'This employment type'} has
                            no leave types configured, so <strong>every</strong> active leave type
                            applies.
                        </>
                    ) : (
                        <>
                            Inherited from{' '}
                            <strong>{employmentTypeLabel ?? config.employment_type}</strong>, plus any
                            employee-specific changes below.
                        </>
                    )}
                </p>
            </div>

            {error && <p role="alert" className="text-nb-caption text-danger">{error}</p>}
            {notice && !error && <p className="text-nb-caption text-primary">{notice}</p>}

            <div className="border border-line rounded-nb overflow-hidden">
                {config.leave_types.length === 0 ? (
                    <p className="p-nb-4 text-nb-body text-fg-subtle">
                        No leave types apply to this employee.
                    </p>
                ) : (
                    config.leave_types.map((t) => row(t, false))
                )}
            </div>

            {config.excluded.length > 0 && (
                <div>
                    <p className="text-nb-caption text-fg-subtle mb-nb-2">
                        Withheld from this employee — balances and history are preserved
                    </p>
                    <div className="border border-line rounded-nb overflow-hidden">
                        {config.excluded.map((t) => row(t, true))}
                    </div>
                </div>
            )}

            {canEdit && addable.length > 0 && (
                <div>
                    <p className="text-nb-caption text-fg-subtle mb-nb-2">
                        Add for this employee only — other employees are unaffected
                    </p>
                    <Cluster gap="tight">
                        {addable.map((t) => (
                            <Button
                                key={t.id}
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={savingId === t.id}
                                onClick={() =>
                                    void apply(
                                        t.id,
                                        () => leaveConfigApi.setPersonOverride(personId, t.id, 'include'),
                                        `${t.name} added for this employee.`,
                                    )
                                }
                            >
                                {savingId === t.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                {t.name}
                            </Button>
                        ))}
                    </Cluster>
                </div>
            )}

            {canEdit && addable.length === 0 && config.excluded.length === 0 && (
                <p className="flex items-center gap-nb-1 text-nb-caption text-fg-subtle">
                    <Check size={12} /> Every leave type in this organization already applies.
                </p>
            )}
        </Stack>
    );
};

export default PersonLeaveConfigTab;
