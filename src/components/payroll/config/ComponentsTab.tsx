import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import { toast } from '@so360/design-system';
import Modal from '../../Modal';
import EmptyState from '../../EmptyState';
import StatusChip from '../StatusChip';
import FieldTooltip from '../FieldTooltip';
import {
    payrollApi, SalaryComponent, SalaryComponentPayload, CalcType, ComponentKind,
} from '../../../services/payrollApi';

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500';
const labelCls = 'block text-xs text-slate-400 mb-1';

const STATUTORY_CODES = ['PF_EMP', 'PF_ER', 'ESI_EMP', 'ESI_ER', 'PT', 'TDS', 'LWF_EMP', 'LWF_ER', 'GRATUITY'];

const ComponentsTab: React.FC = () => {
    const [components, setComponents] = useState<SalaryComponent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<SalaryComponent | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.components.list();
            setComponents(result.data);
        } catch {
            toast.error('Failed to load salary components');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (data: Partial<SalaryComponentPayload>) => {
        try {
            if (editing) {
                await payrollApi.components.update(editing.id, data);
                toast.success('Component updated');
            } else {
                await payrollApi.components.create(data);
                toast.success('Component created');
            }
            setShowModal(false);
            setEditing(null);
            load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save component');
        }
    };

    if (loading) return <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-50">Salary Components</h3>
                <button
                    onClick={() => { setEditing(null); setShowModal(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                    <Plus size={13} /> New Component
                </button>
            </div>

            {components.length === 0 ? (
                <EmptyState
                    icon={Layers}
                    title="No salary components"
                    description="Components are the building blocks of every salary structure — earnings, deductions and employer contributions."
                    action={{ label: 'New Component', onClick: () => setShowModal(true) }}
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Code</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Kind</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Calculation</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Statutory</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {components.map(component => (
                                <tr key={component.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-slate-50">{component.code}</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{component.name}</td>
                                    <td className="px-4 py-3 text-center"><StatusChip status={component.kind} /></td>
                                    <td className="px-4 py-3 text-sm text-slate-400 capitalize">{component.calc_type.replace(/_/g, ' ')}</td>
                                    <td className="px-4 py-3 text-center">
                                        {component.is_statutory ? <StatusChip status="statutory" label={component.statutory_code || 'Statutory'} /> : <span className="text-xs text-slate-600">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center"><StatusChip status={component.is_active ? 'active' : 'inactive'} /></td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => { setEditing(component); setShowModal(true); }} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ComponentModal
                isOpen={showModal}
                component={editing}
                onClose={() => { setShowModal(false); setEditing(null); }}
                onSave={handleSave}
            />
        </div>
    );
};

// =============================================================================
// Component create/edit modal — calc-type-dependent fields
// =============================================================================

const emptyForm = (): Partial<SalaryComponentPayload> => ({
    code: '', name: '', description: '',
    kind: 'earning' as ComponentKind,
    calc_type: 'fixed' as CalcType,
    calc_config: { amount: 0 },
    frequency: 'per_period',
    taxable: true,
    is_statutory: false,
    statutory_code: null,
    prorate_on_lop: false,
    is_active: true,
});

const ComponentModal: React.FC<{
    isOpen: boolean;
    component: SalaryComponent | null;
    onClose: () => void;
    onSave: (data: Partial<SalaryComponentPayload>) => void;
}> = ({ isOpen, component, onClose, onSave }) => {
    const [form, setForm] = useState<Partial<SalaryComponentPayload>>(emptyForm());
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        setValidationError(null);
        setForm(component ? {
            code: component.code, name: component.name, description: component.description,
            kind: component.kind, calc_type: component.calc_type,
            calc_config: component.calc_config || {},
            frequency: component.frequency, taxable: component.taxable,
            is_statutory: component.is_statutory, statutory_code: component.statutory_code,
            prorate_on_lop: component.prorate_on_lop, is_active: component.is_active,
        } : emptyForm());
    }, [component, isOpen]);

    const update = (field: keyof SalaryComponentPayload, value: unknown) =>
        setForm(prev => ({ ...prev, [field]: value }));
    const updateCalc = (patch: Record<string, unknown>) =>
        setForm(prev => ({ ...prev, calc_config: { ...(prev.calc_config || {}), ...patch } }));

    const validate = (): string | null => {
        if (!form.code || !/^[A-Z][A-Z0-9_]*$/.test(form.code)) return 'Code must be UPPER_SNAKE_CASE (letters, numbers, underscores).';
        if (!form.name) return 'Name is required.';
        if (form.calc_type === 'fixed' && (form.calc_config?.amount === undefined || form.calc_config.amount < 0)) return 'A fixed component needs a non-negative default amount.';
        if (form.calc_type === 'percent_of') {
            if (!form.calc_config?.percent || form.calc_config.percent <= 0) return 'A percentage component needs a percentage greater than zero.';
            if (!form.calc_config?.of) return 'Choose which component the percentage is based on.';
        }
        if (form.calc_type === 'formula' && !form.calc_config?.expr) return 'A formula component needs an expression.';
        if (form.is_statutory && !form.statutory_code) return 'Pick the statutory code this component maps to.';
        return null;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const error = validate();
        setValidationError(error);
        if (!error) onSave(form);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={component ? 'Edit Component' : 'New Component'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {validationError && (
                    <div className="px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400">
                        {validationError}
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>
                            Code *
                            <FieldTooltip text="Unique identifier used in formulas (e.g. BASIC, HRA). Immutable once the component is used in a run." />
                        </label>
                        <input type="text" required disabled={!!component} value={form.code || ''} onChange={e => update('code', e.target.value.toUpperCase())} className={`${inputCls} disabled:opacity-50`} placeholder="HRA" />
                    </div>
                    <div>
                        <label className={labelCls}>Name *</label>
                        <input type="text" required value={form.name || ''} onChange={e => update('name', e.target.value)} className={inputCls} placeholder="House Rent Allowance" />
                    </div>
                    <div>
                        <label className={labelCls}>
                            Kind
                            <FieldTooltip text="Earnings add to gross pay; deductions reduce net pay; employer contributions add to employer cost without touching net pay." />
                        </label>
                        <select value={form.kind} onChange={e => update('kind', e.target.value)} className={inputCls}>
                            <option value="earning">Earning</option>
                            <option value="deduction">Deduction</option>
                            <option value="employer_contribution">Employer Contribution</option>
                            <option value="benefit">Benefit</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>
                            Calculation Type
                            <FieldTooltip text="Fixed = flat amount. Percent of = percentage of another component. Formula = expression over components. Slab = rate table (e.g. professional tax)." />
                        </label>
                        <select value={form.calc_type} onChange={e => update('calc_type', e.target.value)} className={inputCls}>
                            <option value="fixed">Fixed amount</option>
                            <option value="percent_of">Percent of another component</option>
                            <option value="formula">Formula</option>
                            <option value="slab">Slab table</option>
                        </select>
                    </div>
                </div>

                {/* Calc-type-dependent fields */}
                {form.calc_type === 'fixed' && (
                    <div>
                        <label className={labelCls}>
                            Default Amount
                            <FieldTooltip text="Default per-period amount. Can be overridden per structure line or per employee." />
                        </label>
                        <input type="number" min={0} step="0.01" value={form.calc_config?.amount ?? ''} onChange={e => updateCalc({ amount: parseFloat(e.target.value) || 0 })} className={inputCls} />
                    </div>
                )}
                {form.calc_type === 'percent_of' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Percentage *</label>
                            <input type="number" min={0} max={100} step="0.01" value={form.calc_config?.percent ?? ''} onChange={e => updateCalc({ percent: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="40" />
                        </div>
                        <div>
                            <label className={labelCls}>
                                Of Component *
                                <FieldTooltip text="The component code this percentage is computed from, e.g. BASIC or GROSS." />
                            </label>
                            <input type="text" value={form.calc_config?.of ?? ''} onChange={e => updateCalc({ of: e.target.value.toUpperCase() })} className={inputCls} placeholder="BASIC" />
                        </div>
                    </div>
                )}
                {form.calc_type === 'formula' && (
                    <div>
                        <label className={labelCls}>
                            Formula Expression *
                            <FieldTooltip text="Expression over component codes and payroll variables (BASIC, GROSS, PAYABLE_DAYS, LOP_DAYS...). Validated when the structure is saved — no code runs from here." />
                        </label>
                        <input type="text" value={form.calc_config?.expr ?? ''} onChange={e => updateCalc({ expr: e.target.value })} className={`${inputCls} font-mono`} placeholder="BASIC * 0.4 + 1000" />
                    </div>
                )}
                {form.calc_type === 'slab' && (
                    <div>
                        <label className={labelCls}>
                            Slab Basis
                            <FieldTooltip text="The figure the slab table is applied to, e.g. GROSS_ANNUAL for tax-style slabs. Slab rows are managed by the statutory pack or via import." />
                        </label>
                        <input type="text" value={form.calc_config?.basis ?? ''} onChange={e => updateCalc({ basis: e.target.value.toUpperCase() })} className={inputCls} placeholder="GROSS_ANNUAL" />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>
                            Frequency
                            <FieldTooltip text="Per period = every pay run. Annual spread = yearly figure divided over periods. One time = only when explicitly added to a run." />
                        </label>
                        <select value={form.frequency} onChange={e => update('frequency', e.target.value)} className={inputCls}>
                            <option value="per_period">Per period</option>
                            <option value="annual_spread">Annual spread</option>
                            <option value="one_time">One time</option>
                            <option value="per_day">Per day</option>
                            <option value="per_hour">Per hour</option>
                        </select>
                    </div>
                    {form.is_statutory && (
                        <div>
                            <label className={labelCls}>
                                Statutory Code *
                                <FieldTooltip text="Maps this component to a statutory rule so the engine applies the right ceilings and rates (e.g. PF_EMP is the employee's Provident Fund share)." />
                            </label>
                            <select value={form.statutory_code || ''} onChange={e => update('statutory_code', e.target.value || null)} className={inputCls}>
                                <option value="">Select…</option>
                                {STATUTORY_CODES.map(code => <option key={code} value={code}>{code}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!form.taxable} onChange={e => update('taxable', e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500" />
                        <span className="text-sm text-slate-300">Taxable</span>
                        <FieldTooltip text="Counts toward taxable income when computing TDS." />
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!form.is_statutory} onChange={e => update('is_statutory', e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500" />
                        <span className="text-sm text-slate-300">Statutory component</span>
                        <FieldTooltip text="Computed by the statutory engine (PF, ESI, PT, TDS...) instead of the component's own calculation." />
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!form.prorate_on_lop} onChange={e => update('prorate_on_lop', e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500" />
                        <span className="text-sm text-slate-300">Prorate on LOP</span>
                        <FieldTooltip text="Reduce this component proportionally for unpaid leave days: amount × payable days ÷ basis days." />
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!form.is_active} onChange={e => update('is_active', e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500" />
                        <span className="text-sm text-slate-300">Active</span>
                    </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
                        {component ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ComponentsTab;
