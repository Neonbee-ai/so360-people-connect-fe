import React, { useEffect, useState } from 'react';
import { Briefcase, CalendarDays, Loader2 } from 'lucide-react';
import MasterListPage from '../../components/MasterListPage';
import Modal from '../../components/Modal';
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
        } catch {
            // Keep the user's selections on screen — making them re-pick after a
            // failed save is how a transient error turns into lost work.
            setError('Could not save. Your selection has been kept — try again.');
        } finally {
            setSaving(false);
        }
    };

    const visible = allTypes.filter((t) =>
        t.name.toLowerCase().includes(search.trim().toLowerCase()),
    );

    return (
        <Modal isOpen onClose={onClose} title={`Leave Types — ${masterName}`}>
            <div className="space-y-4">
                <p className="text-xs text-slate-400">
                    Select the leave types employees under this employment type should receive by
                    default. Employees with their own configuration keep it.
                </p>

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                ) : (
                    <>
                        {/* Selecting nothing is a real choice with a real consequence —
                            say what it is rather than letting HR discover it later. */}
                        {selected.size === 0 && (
                            <p className="text-xs text-amber-400">
                                {configured
                                    ? 'Saving with none selected resets this employment type to unconfigured — every active leave type will apply again.'
                                    : 'This employment type is not configured, so every active leave type applies to its employees.'}
                            </p>
                        )}

                        {allTypes.length > 8 && (
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search leave types"
                                aria-label="Search leave types"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        )}

                        <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800">
                            {visible.length === 0 ? (
                                <p className="px-3 py-4 text-sm text-slate-500">
                                    No leave types found. Create them under Leave Types first.
                                </p>
                            ) : (
                                visible.map((type) => (
                                    <label
                                        key={type.id}
                                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800/50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.has(type.id)}
                                            onChange={() => toggle(type.id)}
                                            className="accent-teal-500"
                                        />
                                        <span className="flex-1 text-sm text-slate-100">{type.name}</span>
                                        <span className="text-[11px] text-slate-500">
                                            {type.is_paid ? 'Paid' : 'Unpaid'}
                                            {type.max_days_per_year != null
                                                ? ` · ${type.max_days_per_year} days/yr`
                                                : ''}
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>

                        {error && (
                            <p role="alert" className="text-xs text-rose-400">
                                {error}
                            </p>
                        )}

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setSelected(new Set())}
                                className="text-xs text-slate-400 hover:text-slate-200"
                            >
                                Clear selection
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void save()}
                                    disabled={saving}
                                    className="px-3 py-1.5 rounded-lg bg-teal-600 text-sm text-white hover:bg-teal-500 disabled:opacity-50"
                                >
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

const EmploymentTypesPage: React.FC = () => {
    const [editingLeave, setEditingLeave] = useState<{ id: string; name: string } | null>(null);

    return (
        <>
            <MasterListPage
                masterType="employment_type"
                label="Employment Type"
                icon={Briefcase}
                description="Full Time, Part Time, Contract, and other employment arrangements"
                rowExtraAction={(row) => (
                    <button
                        onClick={() => setEditingLeave({ id: row.id, name: row.name })}
                        className="p-1.5 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors"
                        title="Configure default leave types"
                        aria-label={`Configure leave types for ${row.name}`}
                    >
                        <CalendarDays size={14} />
                    </button>
                )}
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
