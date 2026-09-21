import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, RotateCcw, X } from 'lucide-react';
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

const SOURCE_CLASS: Record<string, string> = {
    employment_type: 'bg-slate-700/60 text-slate-300',
    employee: 'bg-teal-900/40 text-teal-300',
    org_default: 'bg-slate-800 text-slate-400',
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
            <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading leave configuration…
            </div>
        );
    }

    if (error && !config) {
        return (
            <div className="p-4">
                <p role="alert" className="text-sm text-rose-400">{error}</p>
                <button
                    type="button"
                    onClick={() => void load()}
                    className="mt-2 text-xs text-teal-400 hover:text-teal-300"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!config) return null;

    const assignedIds = new Set(config.leave_types.map((t) => t.id));
    const excludedIds = new Set(config.excluded.map((t) => t.id));
    const addable = allTypes.filter((t) => !assignedIds.has(t.id) && !excludedIds.has(t.id));

    const row = (type: ApplicableLeaveType, withheld: boolean) => (
        <div
            key={type.id}
            className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-800 last:border-0"
        >
            <div className="min-w-0">
                <p className={`text-sm ${withheld ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                    {type.name}
                </p>
                {type.max_days_per_year != null && !withheld && (
                    <p className="text-[11px] text-slate-500">{type.max_days_per_year} days/year</p>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span
                    className={`px-2 py-0.5 rounded text-[11px] ${
                        withheld ? 'bg-rose-900/30 text-rose-300' : SOURCE_CLASS[type.source]
                    }`}
                >
                    {withheld ? 'Withheld' : SOURCE_LABEL[type.source]}
                </span>
                {canEdit && savingId === type.id && (
                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                )}
                {canEdit && savingId !== type.id && withheld && (
                    <button
                        type="button"
                        aria-label={`Restore ${type.name}`}
                        title="Restore — returns this employee to their employment type's default"
                        onClick={() =>
                            void apply(
                                type.id,
                                () => leaveConfigApi.clearPersonOverride(personId, type.id),
                                `${type.name} restored.`,
                            )
                        }
                        className="p-1 text-slate-400 hover:text-teal-300"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                )}
                {canEdit && savingId !== type.id && !withheld && (
                    <button
                        type="button"
                        aria-label={`Remove ${type.name}`}
                        title="Withhold from this employee only. Existing balances and history are kept."
                        onClick={() =>
                            void apply(
                                type.id,
                                () => leaveConfigApi.setPersonOverride(personId, type.id, 'exclude'),
                                `${type.name} withheld from this employee.`,
                            )
                        }
                        className="p-1 text-slate-400 hover:text-rose-300"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-sm font-medium text-slate-100">Leave Configuration</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
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
            </div>

            {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
            {notice && !error && <p className="text-xs text-teal-400">{notice}</p>}

            <div className="border border-slate-800 rounded-lg overflow-hidden">
                {config.leave_types.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-500">
                        No leave types apply to this employee.
                    </p>
                ) : (
                    config.leave_types.map((t) => row(t, false))
                )}
            </div>

            {config.excluded.length > 0 && (
                <div>
                    <p className="text-xs text-slate-500 mb-1">
                        Withheld from this employee — balances and history are preserved
                    </p>
                    <div className="border border-slate-800 rounded-lg overflow-hidden">
                        {config.excluded.map((t) => row(t, true))}
                    </div>
                </div>
            )}

            {canEdit && addable.length > 0 && (
                <div>
                    <p className="text-xs text-slate-500 mb-1">
                        Add for this employee only — other employees are unaffected
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {addable.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                disabled={savingId === t.id}
                                onClick={() =>
                                    void apply(
                                        t.id,
                                        () => leaveConfigApi.setPersonOverride(personId, t.id, 'include'),
                                        `${t.name} added for this employee.`,
                                    )
                                }
                                className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-xs text-slate-300 hover:border-teal-600 hover:text-teal-300 disabled:opacity-50"
                            >
                                {savingId === t.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Plus className="w-3 h-3" />
                                )}
                                {t.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {canEdit && addable.length === 0 && config.excluded.length === 0 && (
                <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Check className="w-3 h-3" /> Every leave type in this organization already applies.
                </p>
            )}
        </div>
    );
};

export default PersonLeaveConfigTab;
