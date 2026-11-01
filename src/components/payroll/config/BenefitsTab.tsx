import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Award } from 'lucide-react';
import {
    toast, Button, Cluster, DataTable, FieldGrid, FormActions, NumberInput, Select, Skeleton, Stack, TextField, Checkbox,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import Modal from '../../Modal';
import EmptyState from '../../EmptyState';
import StatusChip from '../StatusChip';
import { payrollApi, BenefitType } from '../../../services/payrollApi';

const BenefitsTab: React.FC = () => {
    const [benefitTypes, setBenefitTypes] = useState<BenefitType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<BenefitType | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.benefitTypes.list();
            setBenefitTypes(result.data);
        } catch {
            toast.error('Failed to load benefit types');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (data: Partial<BenefitType>) => {
        try {
            if (editing) {
                await payrollApi.benefitTypes.update(editing.id, data);
                toast.success('Benefit type updated');
            } else {
                await payrollApi.benefitTypes.create(data);
                toast.success('Benefit type created');
            }
            setShowModal(false);
            setEditing(null);
            load();
        } catch {
            toast.error('Failed to save benefit type');
        }
    };

    if (loading) return <Skeleton variant="text" lines={6} />;

    const columns: DataTableColumn<BenefitType>[] = [
        { key: 'name', header: 'Name', render: b => <span className="font-medium text-fg">{b.name}</span> },
        { key: 'default_amount', header: 'Default Amount', align: 'right', render: b => <>{b.default_amount ?? '—'}</> },
        { key: 'payer', header: 'Payer', align: 'center', render: b => <span className="capitalize">{b.payer}</span> },
        { key: 'taxable', header: 'Taxable', align: 'center', render: b => <>{b.taxable ? 'Yes' : 'No'}</> },
        { key: 'is_active', header: 'Status', align: 'center', render: b => <StatusChip status={b.is_active ? 'active' : 'inactive'} /> },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: b => <Button variant="ghost" size="sm" onClick={() => { setEditing(b); setShowModal(true); }}>Edit</Button>,
        },
    ];

    return (
        <Stack>
            <Cluster justify="between">
                <h3 className="text-nb-section-title text-fg">Benefit Types</h3>
                <Button size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>
                    <Plus size={13} /> New Benefit Type
                </Button>
            </Cluster>

            {benefitTypes.length === 0 ? (
                <EmptyState
                    icon={Award}
                    title="No benefit types"
                    description="Define benefits like health insurance or meal cards, then assign them to employees from their Payroll tab."
                    action={{ label: 'New Benefit Type', onClick: () => setShowModal(true) }}
                />
            ) : (
                <DataTable columns={columns} rows={benefitTypes} rowKey={b => b.id} name="benefit-types" />
            )}

            <BenefitModal isOpen={showModal} benefit={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSave={handleSave} />
        </Stack>
    );
};

const BenefitModal: React.FC<{
    isOpen: boolean;
    benefit: BenefitType | null;
    onClose: () => void;
    onSave: (data: Partial<BenefitType>) => void;
}> = ({ isOpen, benefit, onClose, onSave }) => {
    const [form, setForm] = useState<Partial<BenefitType>>({ name: '', taxable: false, payer: 'employer', frequency: 'per_period', is_active: true });

    useEffect(() => {
        setForm(benefit ? { ...benefit } : { name: '', taxable: false, payer: 'employer', frequency: 'per_period', is_active: true, default_amount: undefined });
    }, [benefit, isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={benefit ? 'Edit Benefit Type' : 'New Benefit Type'}>
            <form onSubmit={e => { e.preventDefault(); if (form.name) onSave(form); }}>
                <Stack>
                    <TextField name="benefit-name" label="Name" required value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Health Insurance" />
                    <FieldGrid columns={2}>
                        <NumberInput
                            name="benefit-default-amount"
                            label="Default Amount"
                            min={0}
                            step={0.01}
                            value={form.default_amount ?? null}
                            onChange={v => setForm(f => ({ ...f, default_amount: v ?? undefined }))}
                        />
                        <Select
                            name="benefit-payer"
                            label="Payer"
                            hint="Who bears the cost: the employer (adds to employer cost), the employee (deducted from pay), or shared between both."
                            value={form.payer}
                            onChange={e => setForm(f => ({ ...f, payer: e.target.value as BenefitType['payer'] }))}
                            options={[{ value: 'employer', label: 'Employer' }, { value: 'employee', label: 'Employee' }, { value: 'shared', label: 'Shared' }]}
                        />
                    </FieldGrid>
                    <Stack gap="tight">
                        <Checkbox
                            name="benefit-taxable"
                            label="Taxable"
                            description="Employer-paid taxable benefits count as a perquisite in the employee's taxable income."
                            checked={!!form.taxable}
                            onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))}
                        />
                        <Checkbox name="benefit-active" label="Active" checked={!!form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    </Stack>
                    <FormActions divider onCancel={onClose} submitLabel={benefit ? 'Update' : 'Create'} />
                </Stack>
            </form>
        </Modal>
    );
};

export default BenefitsTab;
