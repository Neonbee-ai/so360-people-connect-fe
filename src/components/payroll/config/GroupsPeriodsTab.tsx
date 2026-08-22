import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Users, CalendarRange } from 'lucide-react';
import { toast, getErrorMessage } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import Modal from '../../Modal';
import EmptyState from '../../EmptyState';
import StatusChip from '../StatusChip';
import { payrollApi, toFromMonth, PayrollGroup, PayrollPeriod } from '../../../services/payrollApi';

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500';
const labelCls = 'block text-xs text-slate-400 mb-1';

const GroupsPeriodsTab: React.FC = () => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({ timezone: settings?.timezone || 'UTC', locale: settings?.document_language || 'en-US' });
    const [groups, setGroups] = useState<PayrollGroup[]>([]);
    const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<PayrollGroup | null>(null);
    const [showGenerateDialog, setShowGenerateDialog] = useState(false);

    const loadGroups = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.groups.list();
            setGroups(result.data);
            if (result.data.length && !selectedGroupId) {
                setSelectedGroupId(result.data.find(g => g.is_default)?.id || result.data[0].id);
            }
        } catch {
            toast.error('Failed to load payroll groups');
        } finally {
            setLoading(false);
        }
    }, [selectedGroupId]);

    const loadPeriods = useCallback(async (groupId: string) => {
        if (!groupId) { setPeriods([]); return; }
        try {
            const result = await payrollApi.periods.list({ group_id: groupId });
            setPeriods(result.data);
        } catch {
            toast.error('Failed to load payroll periods');
        }
    }, []);

    useEffect(() => { loadGroups(); }, [loadGroups]);
    useEffect(() => { loadPeriods(selectedGroupId); }, [selectedGroupId, loadPeriods]);

    const handleSaveGroup = async (data: Partial<PayrollGroup>) => {
        try {
            if (editingGroup) {
                await payrollApi.groups.update(editingGroup.id, data);
                toast.success('Payroll group updated');
            } else {
                await payrollApi.groups.create(data);
                toast.success('Payroll group created');
            }
            setShowGroupModal(false);
            setEditingGroup(null);
            loadGroups();
        } catch {
            toast.error('Failed to save payroll group');
        }
    };

    // `from_month` arrives already narrowed to YYYY-MM by the dialog — the API
    // rejects a full calendar date.
    const handleGenerate = async (from_month: string, count: number) => {
        try {
            const result = await payrollApi.periods.generate({
                payroll_group_id: selectedGroupId,
                from_month,
                count,
            });
            // Report what the server did, not what was asked for — months that
            // already had a period are skipped rather than overwritten.
            const created = result?.created ?? 0;
            const skipped = result?.skipped ?? 0;
            if (created === 0 && skipped > 0) {
                toast.success(`All ${skipped} month${skipped === 1 ? '' : 's'} already had periods — nothing to add`);
            } else {
                toast.success(
                    `Generated ${created} period${created === 1 ? '' : 's'}` +
                        (skipped > 0 ? ` (${skipped} already existed)` : ''),
                );
            }
            setShowGenerateDialog(false);
            loadPeriods(selectedGroupId);
        } catch (error) {
            // The backend's validation text is the actionable part; a bare
            // "Failed to generate periods" hid the real cause of this bug.
            console.error('Payroll period generation failed', error);
            toast.error(getErrorMessage(error, 'Failed to generate periods'));
        }
    };

    if (loading) return <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />;

    return (
        <div className="space-y-5">
            {/* Groups */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-50">Payroll Groups</h3>
                <button
                    onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                    <Plus size={13} /> New Group
                </button>
            </div>
            {groups.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No payroll groups"
                    description="Create a payroll group to organize who gets paid together."
                    action={{ label: 'New Group', onClick: () => setShowGroupModal(true) }}
                />
            ) : (
                <div className="grid grid-cols-3 gap-3">
                    {groups.map(group => (
                        <button
                            key={group.id}
                            onClick={() => setSelectedGroupId(group.id)}
                            className={`text-left p-4 rounded-xl border transition-colors ${
                                selectedGroupId === group.id
                                    ? 'bg-teal-500/10 border-teal-500/40'
                                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-50">{group.name}</span>
                                {group.is_default && <StatusChip status="active" label="Default" />}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">{group.code}</div>
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={e => { e.stopPropagation(); setEditingGroup(group); setShowGroupModal(true); }}
                                onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setEditingGroup(group); setShowGroupModal(true); } }}
                                className="inline-block mt-2 text-xs text-teal-400 hover:text-teal-300"
                            >
                                Edit
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Periods */}
            {selectedGroupId && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-50">Pay Periods</h3>
                        <button
                            onClick={() => setShowGenerateDialog(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                        >
                            <CalendarRange size={13} /> Generate periods
                        </button>
                    </div>
                    {periods.length === 0 ? (
                        <p className="text-sm text-slate-400 py-6 text-center bg-slate-900 border border-slate-800 rounded-xl">
                            No periods yet for this group. Generate periods to start running payroll.
                        </p>
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-800/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Period</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Pay Date</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {periods.map(period => (
                                        <tr key={period.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-slate-50">
                                                {formatters.formatDate(period.period_start)} – {formatters.formatDate(period.period_end)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-400">{formatters.formatDate(period.pay_date)}</td>
                                            <td className="px-4 py-3 text-center"><StatusChip status={period.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <GroupModal
                isOpen={showGroupModal}
                group={editingGroup}
                onClose={() => { setShowGroupModal(false); setEditingGroup(null); }}
                onSave={handleSaveGroup}
            />
            <GeneratePeriodsDialog
                isOpen={showGenerateDialog}
                onClose={() => setShowGenerateDialog(false)}
                onGenerate={handleGenerate}
            />
        </div>
    );
};

const GroupModal: React.FC<{
    isOpen: boolean;
    group: PayrollGroup | null;
    onClose: () => void;
    onSave: (data: Partial<PayrollGroup>) => void;
}> = ({ isOpen, group, onClose, onSave }) => {
    const [form, setForm] = useState<Partial<PayrollGroup>>({ name: '', code: '', description: '', is_default: false, is_active: true });

    useEffect(() => {
        setForm(group
            ? { name: group.name, code: group.code, description: group.description || '', is_default: group.is_default, is_active: group.is_active }
            : { name: '', code: '', description: '', is_default: false, is_active: true });
    }, [group, isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={group ? 'Edit Payroll Group' : 'New Payroll Group'}>
            <form onSubmit={e => { e.preventDefault(); if (form.name && form.code) onSave(form); }} className="space-y-4">
                <div>
                    <label className={labelCls}>Name *</label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Monthly Staff" />
                </div>
                <div>
                    <label className={labelCls}>Code *</label>
                    <input type="text" required value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className={inputCls} placeholder="MONTHLY" />
                </div>
                <div>
                    <label className={labelCls}>Description</label>
                    <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} rows={2} />
                </div>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500" />
                    <span className="text-sm text-slate-300">Default group for new employees</span>
                </label>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
                        {group ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const GeneratePeriodsDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    /** Receives the month only, as YYYY-MM. */
    onGenerate: (fromMonth: string, count: number) => void;
}> = ({ isOpen, onClose, onGenerate }) => {
    const [from, setFrom] = useState('');
    const [count, setCount] = useState(12);
    const fromMonth = toFromMonth(from);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Pay Periods" size="sm">
            {/* The picker is a calendar day for familiarity, but only its month
                reaches the API — sending the day failed DTO validation. */}
            <form onSubmit={e => { e.preventDefault(); if (fromMonth) onGenerate(fromMonth, count); }} className="space-y-4">
                <p className="text-xs text-slate-400">
                    Periods are generated ahead using this group's pay day rule. Existing periods are never overwritten.
                </p>
                <div>
                    <label className={labelCls}>Start From *</label>
                    <input type="date" required value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
                    {/* Only the month is used — say so, rather than letting the
                        day silently disappear into the request. */}
                    {fromMonth && (
                        <p className="mt-1 text-xs text-slate-500">
                            Periods start from {fromMonth} — the day you pick is ignored.
                        </p>
                    )}
                </div>
                <div>
                    <label className={labelCls}>Number of Periods</label>
                    <input type="number" min={1} max={24} value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} className={inputCls} />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">Generate</button>
                </div>
            </form>
        </Modal>
    );
};

export default GroupsPeriodsTab;
