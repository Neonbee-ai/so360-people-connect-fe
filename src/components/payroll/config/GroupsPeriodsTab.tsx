import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Users, CalendarRange } from 'lucide-react';
import {
    toast, getErrorMessage, Button, Cluster, DataTable, DateInput, FieldGrid, FormActions, Grid, NumberInput, Select, Skeleton, Stack, TextField, Textarea, Checkbox,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import Modal from '../../Modal';
import EmptyState from '../../EmptyState';
import StatusChip from '../StatusChip';
import { payrollApi, toFromMonth, PayrollGroup, PayrollPeriod, PayFrequency } from '../../../services/payrollApi';

const PAY_FREQUENCIES: { value: PayFrequency; label: string }[] = [
    { value: 'monthly', label: 'Monthly — one period per calendar month' },
    { value: 'semi_monthly', label: 'Semi-monthly — 1st–15th and 16th–month end' },
    { value: 'bi_weekly', label: 'Bi-weekly — every 14 days' },
    { value: 'weekly', label: 'Weekly — every 7 days' },
];

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

    if (loading) return <Skeleton variant="text" lines={6} />;

    const periodColumns: DataTableColumn<PayrollPeriod>[] = [
        {
            key: 'period',
            header: 'Period',
            render: period => <>{formatters.formatDate(period.period_start)} – {formatters.formatDate(period.period_end)}</>,
        },
        { key: 'pay_date', header: 'Pay Date', render: period => <span className="text-fg-muted">{formatters.formatDate(period.pay_date)}</span> },
        { key: 'status', header: 'Status', align: 'center', render: period => <StatusChip status={period.status} /> },
    ];

    return (
        <Stack>
            {/* Groups */}
            <Cluster justify="between">
                <h3 className="text-nb-section-title text-fg">Payroll Groups</h3>
                <Button size="sm" onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}>
                    <Plus size={13} /> New Group
                </Button>
            </Cluster>
            {groups.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No payroll groups"
                    description="Create a payroll group to organize who gets paid together."
                    action={{ label: 'New Group', onClick: () => setShowGroupModal(true) }}
                />
            ) : (
                <Grid columns={3} gap="md">
                    {groups.map(group => (
                        <Stack key={group.id} gap="tight">
                            <Button
                                variant={selectedGroupId === group.id ? 'secondary' : 'ghost'}
                                onClick={() => setSelectedGroupId(group.id)}
                            >
                                <Stack gap="tight">
                                    <Cluster justify="between">
                                        <span className="text-nb-body text-fg">{group.name}</span>
                                        {group.is_default && <StatusChip status="active" label="Default" />}
                                    </Cluster>
                                    <span className="text-nb-caption text-fg-muted">{group.code}</span>
                                </Stack>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingGroup(group); setShowGroupModal(true); }}
                                onKeyDown={e => { if (e.key === 'Enter') { setEditingGroup(group); setShowGroupModal(true); } }}
                            >
                                Edit
                            </Button>
                        </Stack>
                    ))}
                </Grid>
            )}

            {/* Periods */}
            {selectedGroupId && (
                <Stack>
                    <Cluster justify="between">
                        <h3 className="text-nb-section-title text-fg">Pay Periods</h3>
                        <Button variant="secondary" size="sm" onClick={() => setShowGenerateDialog(true)}>
                            <CalendarRange size={13} /> Generate periods
                        </Button>
                    </Cluster>
                    {periods.length === 0 ? (
                        <EmptyState
                            icon={CalendarRange}
                            title="No periods yet for this group."
                            description="Generate periods to start running payroll."
                        />
                    ) : (
                        <DataTable columns={periodColumns} rows={periods} rowKey={p => p.id} name="pay-periods" />
                    )}
                </Stack>
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
        </Stack>
    );
};

const GroupModal: React.FC<{
    isOpen: boolean;
    group: PayrollGroup | null;
    onClose: () => void;
    onSave: (data: Partial<PayrollGroup>) => void;
}> = ({ isOpen, group, onClose, onSave }) => {
    const [form, setForm] = useState<Partial<PayrollGroup>>({ name: '', code: '', description: '', pay_frequency: 'monthly', is_default: false, is_active: true });

    useEffect(() => {
        setForm(group
            ? { name: group.name, code: group.code, description: group.description || '', pay_frequency: group.pay_frequency || 'monthly', is_default: group.is_default, is_active: group.is_active }
            : { name: '', code: '', description: '', pay_frequency: 'monthly', is_default: false, is_active: true });
    }, [group, isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={group ? 'Edit Payroll Group' : 'New Payroll Group'}>
            <form onSubmit={e => { e.preventDefault(); if (form.name && form.code) onSave(form); }}>
                <Stack>
                    <TextField name="group-name" label="Name" required value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Monthly Staff" />
                    <TextField name="group-code" label="Code" required value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="MONTHLY" />
                    <Select
                        name="group-pay-frequency"
                        label="Pay Frequency"
                        hint="Decides how generated periods are split."
                        value={form.pay_frequency || 'monthly'}
                        onChange={e => setForm(f => ({ ...f, pay_frequency: e.target.value as PayFrequency }))}
                        options={PAY_FREQUENCIES}
                    />
                    <Textarea name="group-description" label="Description" rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    <Checkbox name="group-default" label="Default group for new employees" checked={!!form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
                    <FormActions divider onCancel={onClose} submitLabel={group ? 'Update' : 'Create'} />
                </Stack>
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
            <form onSubmit={e => { e.preventDefault(); if (fromMonth) onGenerate(fromMonth, count); }}>
                <Stack>
                    <p className="text-nb-caption text-fg-muted">
                        Periods are generated ahead using this group's pay day rule. Existing periods are never overwritten.
                    </p>
                    {/* Only the month is used — say so, rather than letting the
                        day silently disappear into the request. */}
                    <DateInput
                        name="generate-from"
                        label="Start From"
                        required
                        value={from}
                        onChange={v => setFrom(v)}
                        hint={fromMonth ? `Periods start from ${fromMonth} — the day you pick is ignored.` : undefined}
                    />
                    <NumberInput name="generate-count" label="Number of Periods" min={1} max={24} value={count} onChange={v => setCount(v || 1)} />
                    <FormActions divider onCancel={onClose} submitLabel="Generate" />
                </Stack>
            </form>
        </Modal>
    );
};

export default GroupsPeriodsTab;
