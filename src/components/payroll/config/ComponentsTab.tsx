import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import {
    toast, Alert, Button, Checkbox, Cluster, DataTable, FieldGrid, FormActions, NumberInput, Select, Skeleton, Stack, TextField,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import Modal from '../../Modal';
import EmptyState from '../../EmptyState';
import StatusChip from '../StatusChip';
import {
    payrollApi, SalaryComponent, SalaryComponentPayload, CalcType, ComponentKind,
} from '../../../services/payrollApi';

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

    if (loading) return <Skeleton variant="text" lines={6} />;

    const columns: DataTableColumn<SalaryComponent>[] = [
        { key: 'code', header: 'Code', render: c => <span className="font-medium text-fg">{c.code}</span> },
        { key: 'name', header: 'Name', render: c => <>{c.name}</> },
        { key: 'kind', header: 'Kind', align: 'center', render: c => <StatusChip status={c.kind} /> },
        { key: 'calc_type', header: 'Calculation', render: c => <span className="capitalize">{c.calc_type.replace(/_/g, ' ')}</span> },
        {
            key: 'is_statutory',
            header: 'Statutory',
            align: 'center',
            render: c => c.is_statutory
                ? <StatusChip status="statutory" label={c.statutory_code || 'Statutory'} />
                : <span className="text-nb-caption text-fg-subtle">—</span>,
        },
        { key: 'is_active', header: 'Status', align: 'center', render: c => <StatusChip status={c.is_active ? 'active' : 'inactive'} /> },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: c => <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setShowModal(true); }}>Edit</Button>,
        },
    ];

    return (
        <Stack>
            <Cluster justify="between">
                <h3 className="text-nb-section-title text-fg">Salary Components</h3>
                <Button size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>
                    <Plus size={13} /> New Component
                </Button>
            </Cluster>

            {components.length === 0 ? (
                <EmptyState
                    icon={Layers}
                    title="No salary components"
                    description="Components are the building blocks of every salary structure — earnings, deductions and employer contributions."
                    action={{ label: 'New Component', onClick: () => setShowModal(true) }}
                />
            ) : (
                <DataTable columns={columns} rows={components} rowKey={c => c.id} name="salary-components" />
            )}

            <ComponentModal
                isOpen={showModal}
                component={editing}
                onClose={() => { setShowModal(false); setEditing(null); }}
                onSave={handleSave}
            />
        </Stack>
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
            <form onSubmit={handleSubmit}>
                <Stack>
                    {validationError && <Alert variant="error">{validationError}</Alert>}
                    <FieldGrid columns={2}>
                        <TextField
                            name="component-code"
                            label="Code"
                            required
                            disabled={!!component}
                            value={form.code || ''}
                            onChange={e => update('code', e.target.value.toUpperCase())}
                            placeholder="HRA"
                            hint="Unique identifier used in formulas (e.g. BASIC, HRA). Immutable once the component is used in a run."
                        />
                        <TextField
                            name="component-name"
                            label="Name"
                            required
                            value={form.name || ''}
                            onChange={e => update('name', e.target.value)}
                            placeholder="House Rent Allowance"
                        />
                        <Select
                            name="component-kind"
                            label="Kind"
                            hint="Earnings add to gross pay; deductions reduce net pay; employer contributions add to employer cost without touching net pay."
                            value={form.kind}
                            onChange={e => update('kind', e.target.value)}
                            options={[{ value: 'earning', label: 'Earning' }, { value: 'deduction', label: 'Deduction' }, { value: 'employer_contribution', label: 'Employer Contribution' }, { value: 'benefit', label: 'Benefit' }]}
                        />
                        <Select
                            name="component-calc-type"
                            label="Calculation Type"
                            hint="Fixed = flat amount. Percent of = percentage of another component. Formula = expression over components. Slab = rate table (e.g. professional tax)."
                            value={form.calc_type}
                            onChange={e => update('calc_type', e.target.value)}
                            options={[{ value: 'fixed', label: 'Fixed amount' }, { value: 'percent_of', label: 'Percent of another component' }, { value: 'formula', label: 'Formula' }, { value: 'slab', label: 'Slab table' }]}
                        />
                    </FieldGrid>

                    {/* Calc-type-dependent fields */}
                    {form.calc_type === 'fixed' && (
                        <NumberInput
                            name="component-default-amount"
                            label="Default Amount"
                            hint="Default per-period amount. Can be overridden per structure line or per employee."
                            min={0}
                            step={0.01}
                            value={form.calc_config?.amount ?? null}
                            onChange={v => updateCalc({ amount: v || 0 })}
                        />
                    )}
                    {form.calc_type === 'percent_of' && (
                        <FieldGrid columns={2}>
                            <NumberInput
                                name="component-percent"
                                label="Percentage *"
                                min={0}
                                max={100}
                                step={0.01}
                                value={form.calc_config?.percent ?? null}
                                onChange={v => updateCalc({ percent: v || 0 })}
                                placeholder="40"
                            />
                            <TextField
                                name="component-of"
                                label="Of Component *"
                                hint="The component code this percentage is computed from, e.g. BASIC or GROSS."
                                value={form.calc_config?.of ?? ''}
                                onChange={e => updateCalc({ of: e.target.value.toUpperCase() })}
                                placeholder="BASIC"
                            />
                        </FieldGrid>
                    )}
                    {form.calc_type === 'formula' && (
                        <TextField
                            name="component-formula"
                            label="Formula Expression *"
                            hint="Expression over component codes and payroll variables (BASIC, GROSS, PAYABLE_DAYS, LOP_DAYS...). Validated when the structure is saved — no code runs from here."
                            value={form.calc_config?.expr ?? ''}
                            onChange={e => updateCalc({ expr: e.target.value })}
                            placeholder="BASIC * 0.4 + 1000"
                        />
                    )}
                    {form.calc_type === 'slab' && (
                        <TextField
                            name="component-slab-basis"
                            label="Slab Basis"
                            hint="The figure the slab table is applied to, e.g. GROSS_ANNUAL for tax-style slabs. Slab rows are managed by the statutory pack or via import."
                            value={form.calc_config?.basis ?? ''}
                            onChange={e => updateCalc({ basis: e.target.value.toUpperCase() })}
                            placeholder="GROSS_ANNUAL"
                        />
                    )}

                    <FieldGrid columns={2}>
                        <Select
                            name="component-frequency"
                            label="Frequency"
                            hint="Per period = every pay run. Annual spread = yearly figure divided over periods. One time = only when explicitly added to a run."
                            value={form.frequency}
                            onChange={e => update('frequency', e.target.value)}
                            options={[{ value: 'per_period', label: 'Per period' }, { value: 'annual_spread', label: 'Annual spread' }, { value: 'one_time', label: 'One time' }, { value: 'per_day', label: 'Per day' }, { value: 'per_hour', label: 'Per hour' }]}
                        />
                        {form.is_statutory && (
                            <Select
                                name="component-statutory-code"
                                label="Statutory Code *"
                                hint="Maps this component to a statutory rule so the engine applies the right ceilings and rates (e.g. PF_EMP is the employee's Provident Fund share)."
                                value={form.statutory_code || ''}
                                onChange={e => update('statutory_code', e.target.value || null)}
                                options={[{ value: '', label: 'Select…' }, ...STATUTORY_CODES.map((code) => ({ value: code, label: code }))]}
                            />
                        )}
                    </FieldGrid>

                    <Stack gap="tight">
                        <Checkbox name="component-taxable" label="Taxable" description="Counts toward taxable income when computing TDS." checked={!!form.taxable} onChange={e => update('taxable', e.target.checked)} />
                        <Checkbox name="component-statutory" label="Statutory component" description="Computed by the statutory engine (PF, ESI, PT, TDS...) instead of the component's own calculation." checked={!!form.is_statutory} onChange={e => update('is_statutory', e.target.checked)} />
                        <Checkbox name="component-prorate" label="Prorate on LOP" description="Reduce this component proportionally for unpaid leave days: amount × payable days ÷ basis days." checked={!!form.prorate_on_lop} onChange={e => update('prorate_on_lop', e.target.checked)} />
                        <Checkbox name="component-active" label="Active" checked={!!form.is_active} onChange={e => update('is_active', e.target.checked)} />
                    </Stack>

                    <FormActions divider onCancel={onClose} submitLabel={component ? 'Update' : 'Create'} />
                </Stack>
            </form>
        </Modal>
    );
};

export default ComponentsTab;
