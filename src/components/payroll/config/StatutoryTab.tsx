import React, { useEffect, useState } from 'react';
import { Save, Landmark } from 'lucide-react';
import {
    toast, Alert, Button, Card, Checkbox, Cluster, DataTable, FieldGrid, NumberInput, Select, Skeleton, Stack, TextField,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import EmptyState from '../../EmptyState';
import FieldTooltip from '../FieldTooltip';
import { payrollApi, StatutoryConfig } from '../../../services/payrollApi';

type SectionKey = 'pf' | 'esi' | 'pt' | 'lwf' | 'tds' | 'gratuity';

const SECTION_META: { key: SectionKey; title: string; tooltip: string }[] = [
    { key: 'pf', title: 'Provident Fund (PF)', tooltip: 'Retirement savings scheme. Both employee and employer contribute a percentage of PF wages, subject to the wage ceiling.' },
    { key: 'esi', title: 'Employee State Insurance (ESI)', tooltip: 'Medical insurance for employees whose monthly wages are at or below the wage ceiling.' },
    { key: 'pt', title: 'Professional Tax (PT)', tooltip: 'State-level tax on employment, deducted per state slab table.' },
    { key: 'lwf', title: 'Labour Welfare Fund (LWF)', tooltip: 'State welfare contribution, usually a small fixed amount from employee and employer.' },
    { key: 'tds', title: 'Income Tax (TDS)', tooltip: 'Tax Deducted at Source on salary, annualized from projected yearly income per the selected regime slabs.' },
    { key: 'gratuity', title: 'Gratuity', tooltip: 'Statutory retirement benefit accrued at a number of days of wages per completed year of service.' },
];

const IDENTIFIER_TOOLTIPS: Record<string, string> = {
    pan: 'Permanent Account Number — the employee\'s income-tax identity, required for TDS.',
    uan: "Universal Account Number used for managing an employee's PF account.",
    esic_number: 'The employee\'s ESI insurance number for medical benefits.',
    lwf_number: 'The employee\'s Labour Welfare Fund registration number.',
    aadhaar: 'National identity number. Stored encrypted and always masked in the UI.',
};

const StatutoryTab: React.FC = () => {
    const [config, setConfig] = useState<StatutoryConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        payrollApi.statutory.get()
            .then(setConfig)
            .catch(() => toast.error('Failed to load statutory configuration'))
            .finally(() => setLoading(false));
    }, []);

    const updateSection = (section: SectionKey, patch: Record<string, unknown>) =>
        setConfig(prev => prev ? {
            ...prev,
            config: { ...prev.config, [section]: { ...(prev.config[section] as object || {}), ...patch } },
        } : prev);

    const handleSave = async () => {
        if (!config) return;
        try {
            setSaving(true);
            const saved = await payrollApi.statutory.update(config);
            setConfig(saved);
            toast.success('Statutory configuration saved');
        } catch {
            toast.error('Failed to save statutory configuration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Skeleton variant="text" lines={6} />;
    if (!config) {
        return <EmptyState icon={Landmark} title="Statutory pack unavailable" description="The India statutory pack has not been provisioned for this organization yet." />;
    }

    const c = config.config;

    const identifierColumns: DataTableColumn<NonNullable<typeof c.identifiers>[number]>[] = [
        {
            key: 'label',
            header: 'Identifier',
            render: identifier => (
                <Cluster>
                    {identifier.label}
                    <FieldTooltip text={IDENTIFIER_TOOLTIPS[identifier.key] || `${identifier.label} statutory identifier.`} />
                </Cluster>
            ),
        },
        {
            key: 'required_for_payroll',
            header: 'Required for Payroll',
            align: 'center',
            render: identifier => (
                <Checkbox
                    name={`identifier-${identifier.key}-required`}
                    label={`${identifier.label} required for payroll`}
                    hideLabel
                    checked={identifier.required_for_payroll}
                    onChange={e => setConfig(prev => prev ? {
                        ...prev,
                        config: {
                            ...prev.config,
                            identifiers: (prev.config.identifiers || []).map(i =>
                                i.key === identifier.key ? { ...i, required_for_payroll: e.target.checked } : i),
                        },
                    } : prev)}
                />
            ),
        },
        { key: 'masked', header: 'Masked', align: 'center', render: identifier => <span className="text-fg-muted">{identifier.masked ? 'Yes' : 'No'}</span> },
    ];

    return (
        <Stack>
            <Alert variant="info">
                India statutory pack. Rates and ceilings below drive the payroll engine — every change is audited.
            </Alert>

            {SECTION_META.map(({ key, title, tooltip }) => {
                const section = (c[key] as Record<string, unknown>) || {};
                const enabled = !!section.enabled;
                return (
                    <Card
                        key={key}
                        title={title}
                        actions={(
                            <Checkbox
                                name={`statutory-${key}-enabled`}
                                label="Enabled"
                                checked={enabled}
                                onChange={e => updateSection(key, { enabled: e.target.checked })}
                            />
                        )}
                    >
                        <Stack>
                            <p className="text-nb-caption text-fg-muted">{tooltip}</p>
                            {enabled && (
                                <FieldGrid columns={3}>
                                    {key === 'pf' && (<>
                                        <NumberField name="pf-wage-ceiling" label="Wage Ceiling" tooltip="PF contributions are computed on wages up to this monthly ceiling when 'restrict to ceiling' is on." value={c.pf?.wage_ceiling} onChange={v => updateSection('pf', { wage_ceiling: v })} />
                                        <NumberField name="pf-employee-rate" label="Employee Rate %" tooltip="Employee's PF contribution as a percentage of PF wages." value={c.pf?.employee_rate} onChange={v => updateSection('pf', { employee_rate: v })} />
                                        <NumberField name="pf-employer-rate" label="Employer Rate %" tooltip="Employer's PF contribution as a percentage of PF wages (includes the EPS portion)." value={c.pf?.employer_rate} onChange={v => updateSection('pf', { employer_rate: v })} />
                                        <NumberField name="pf-eps-rate" label="EPS Rate %" tooltip="Portion of the employer contribution routed to the Employees' Pension Scheme." value={c.pf?.eps_rate} onChange={v => updateSection('pf', { eps_rate: v })} />
                                        <Checkbox
                                            name="pf-restrict-to-ceiling"
                                            label="Restrict to wage ceiling"
                                            description="When on, contributions are capped at the ceiling even for higher wages; when off, the full wage is used."
                                            checked={!!c.pf?.restrict_to_ceiling}
                                            onChange={e => updateSection('pf', { restrict_to_ceiling: e.target.checked })}
                                        />
                                    </>)}
                                    {key === 'esi' && (<>
                                        <NumberField name="esi-wage-ceiling" label="Wage Ceiling" tooltip="Employees earning at or below this monthly gross are covered by ESI." value={c.esi?.wage_ceiling} onChange={v => updateSection('esi', { wage_ceiling: v })} />
                                        <NumberField name="esi-employee-rate" label="Employee Rate %" tooltip="Employee's ESI contribution rate." value={c.esi?.employee_rate} onChange={v => updateSection('esi', { employee_rate: v })} />
                                        <NumberField name="esi-employer-rate" label="Employer Rate %" tooltip="Employer's ESI contribution rate." value={c.esi?.employer_rate} onChange={v => updateSection('esi', { employer_rate: v })} />
                                    </>)}
                                    {key === 'pt' && (
                                        <Stack gap="tight">
                                            <TextField
                                                name="pt-state"
                                                label="State"
                                                hint="Professional Tax slabs differ by state. The engine applies the slab table for the selected state."
                                                value={c.pt?.state || ''}
                                                onChange={e => updateSection('pt', { state: e.target.value.toUpperCase() })}
                                                placeholder="KL"
                                            />
                                            <p className="text-nb-caption text-fg-subtle">Slab table for the selected state ships as seed data and can be adjusted via import.</p>
                                        </Stack>
                                    )}
                                    {key === 'lwf' && (<>
                                        <TextField name="lwf-state" label="State" value={c.lwf?.state || ''} onChange={e => updateSection('lwf', { state: e.target.value.toUpperCase() })} />
                                        <NumberField name="lwf-employee-amount" label="Employee Amount" tooltip="Flat LWF amount deducted from the employee per contribution cycle." value={c.lwf?.employee_amount} onChange={v => updateSection('lwf', { employee_amount: v })} />
                                        <NumberField name="lwf-employer-amount" label="Employer Amount" tooltip="Flat LWF amount contributed by the employer per contribution cycle." value={c.lwf?.employer_amount} onChange={v => updateSection('lwf', { employer_amount: v })} />
                                    </>)}
                                    {key === 'tds' && (<>
                                        <Select
                                            name="tds-default-regime"
                                            label="Default Regime"
                                            hint="The tax regime applied when an employee has not chosen one. Employees can switch regime on their payroll profile."
                                            value={c.tds?.default_regime || 'new'}
                                            onChange={e => updateSection('tds', { default_regime: e.target.value })}
                                            options={[{ value: 'new', label: 'New regime' }, { value: 'old', label: 'Old regime' }]}
                                        />
                                        <TextField
                                            name="tds-slabs-fy"
                                            label="Slab FY"
                                            hint="Which fiscal year's slab table the engine uses, e.g. 2026-27."
                                            value={c.tds?.slabs_fy || ''}
                                            onChange={e => updateSection('tds', { slabs_fy: e.target.value })}
                                            placeholder="2026-27"
                                        />
                                        <NumberField name="tds-standard-deduction" label="Standard Deduction" tooltip="Flat deduction from salary income before slabs are applied." value={c.tds?.standard_deduction} onChange={v => updateSection('tds', { standard_deduction: v })} />
                                    </>)}
                                    {key === 'gratuity' && (
                                        <NumberField name="gratuity-rate-days" label="Rate (days/year)" tooltip="Days of last-drawn wages accrued per completed year of service (statutory default is 15)." value={c.gratuity?.rate_days} onChange={v => updateSection('gratuity', { rate_days: v })} />
                                    )}
                                </FieldGrid>
                            )}
                        </Stack>
                    </Card>
                );
            })}

            {/* Identifiers */}
            <Card title="Employee Identifiers">
                <Stack>
                    <p className="text-nb-caption text-fg-muted">Identifiers collected on each employee's payroll profile. 'Required for payroll' identifiers block an employee from being included in a run until filled.</p>
                    <DataTable columns={identifierColumns} rows={c.identifiers || []} rowKey={i => i.key} name="statutory-identifiers" />
                </Stack>
            </Card>

            <Cluster justify="end">
                <Button onClick={handleSave} disabled={saving}>
                    <Save size={14} /> {saving ? 'Saving…' : 'Save Statutory Config'}
                </Button>
            </Cluster>
        </Stack>
    );
};

const NumberField: React.FC<{
    name: string;
    label: string;
    tooltip: string;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
}> = ({ name, label, tooltip, value, onChange }) => (
    <NumberInput
        name={name}
        label={label}
        hint={tooltip}
        min={0}
        step={0.01}
        value={value ?? null}
        onChange={v => onChange(v ?? undefined)}
    />
);

export default StatutoryTab;
