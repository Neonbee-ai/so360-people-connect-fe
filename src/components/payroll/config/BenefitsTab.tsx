import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Award } from 'lucide-react';
import { toast, Select } from '@so360/design-system';
import Modal from '../../Modal';
import EmptyState from '../../EmptyState';
import StatusChip from '../StatusChip';
import FieldTooltip from '../FieldTooltip';
import { payrollApi, BenefitType } from '../../../services/payrollApi';

const inputCls = 'w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary';
const labelCls = 'block text-xs text-fg-muted mb-1';

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

    if (loading) return <div className="h-64 bg-surface-raised/50 rounded-nb animate-pulse" />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-fg">Benefit Types</h3>
                <button
                    onClick={() => { setEditing(null); setShowModal(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-fg text-xs font-medium rounded-nb transition-colors"
                >
                    <Plus size={13} /> New Benefit Type
                </button>
            </div>

            {benefitTypes.length === 0 ? (
                <EmptyState
                    icon={Award}
                    title="No benefit types"
                    description="Define benefits like health insurance or meal cards, then assign them to employees from their Payroll tab."
                    action={{ label: 'New Benefit Type', onClick: () => setShowModal(true) }}
                />
            ) : (
                <div className="bg-surface border border-line rounded-nb overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-surface-raised/50 border-b border-line">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Default Amount</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Payer</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Taxable</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {benefitTypes.map(benefit => (
                                <tr key={benefit.id} className="hover:bg-surface-raised/50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-fg">{benefit.name}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted text-right">{benefit.default_amount ?? '—'}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted text-center capitalize">{benefit.payer}</td>
                                    <td className="px-4 py-3 text-center text-sm text-fg-muted">{benefit.taxable ? 'Yes' : 'No'}</td>
                                    <td className="px-4 py-3 text-center"><StatusChip status={benefit.is_active ? 'active' : 'inactive'} /></td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => { setEditing(benefit); setShowModal(true); }} className="text-xs text-primary hover:text-primary transition-colors">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <BenefitModal isOpen={showModal} benefit={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSave={handleSave} />
        </div>
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
            <form onSubmit={e => { e.preventDefault(); if (form.name) onSave(form); }} className="space-y-4">
                <div>
                    <label className={labelCls}>Name *</label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Health Insurance" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Default Amount</label>
                        <input type="number" min={0} step="0.01" value={form.default_amount ?? ''} onChange={e => setForm(f => ({ ...f, default_amount: e.target.value ? parseFloat(e.target.value) : undefined }))} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>
                            Payer
                            <FieldTooltip text="Who bears the cost: the employer (adds to employer cost), the employee (deducted from pay), or shared between both." />
                        </label>
                        <Select name="benefitstab-select-11" value={form.payer} onChange={e => setForm(f => ({ ...f, payer: e.target.value as BenefitType['payer'] }))} options={[{ value: "employer", label: "Employer" }, { value: "employee", label: "Employee" }, { value: "shared", label: "Shared" }]} />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!form.taxable} onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))} className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary" />
                        <span className="text-sm text-fg">Taxable</span>
                        <FieldTooltip text="Employer-paid taxable benefits count as a perquisite in the employee's taxable income." />
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary" />
                        <span className="text-sm text-fg">Active</span>
                    </label>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors">{benefit ? 'Update' : 'Create'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default BenefitsTab;
