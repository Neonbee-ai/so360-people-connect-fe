import React, { useEffect, useState } from 'react';
import { Save, Landmark } from 'lucide-react';
import { toast, Select } from '@so360/design-system';
import EmptyState from '../../EmptyState';
import FieldTooltip from '../FieldTooltip';
import { payrollApi, StatutoryConfig } from '../../../services/payrollApi';

const inputCls = 'w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary';
const labelCls = 'block text-xs text-fg-muted mb-1';

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

    if (loading) return <div className="h-64 bg-surface-raised/50 rounded-nb animate-pulse" />;
    if (!config) {
        return <EmptyState icon={Landmark} title="Statutory pack unavailable" description="The India statutory pack has not been provisioned for this organization yet." />;
    }

    const c = config.config;

    return (
        <div className="space-y-4 max-w-3xl">
            <div className="px-4 py-3 bg-surface-raised/50 border border-line-strong rounded-nb text-xs text-fg-muted">
                India statutory pack. Rates and ceilings below drive the payroll engine — every change is audited.
            </div>

            {SECTION_META.map(({ key, title, tooltip }) => {
                const section = (c[key] as Record<string, unknown>) || {};
                const enabled = !!section.enabled;
                return (
                    <div key={key} className="bg-surface border border-line rounded-nb">
                        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                            <div className="flex items-center">
                                <h4 className="text-sm font-semibold text-fg">{title}</h4>
                                <FieldTooltip text={tooltip} />
                            </div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={e => updateSection(key, { enabled: e.target.checked })}
                                    className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary"
                                />
                                <span className="text-xs text-fg-muted">Enabled</span>
                            </label>
                        </div>
                        {enabled && (
                            <div className="p-4 grid grid-cols-3 gap-4">
                                {key === 'pf' && (<>
                                    <NumberField label="Wage Ceiling" tooltip="PF contributions are computed on wages up to this monthly ceiling when 'restrict to ceiling' is on." value={c.pf?.wage_ceiling} onChange={v => updateSection('pf', { wage_ceiling: v })} />
                                    <NumberField label="Employee Rate %" tooltip="Employee's PF contribution as a percentage of PF wages." value={c.pf?.employee_rate} onChange={v => updateSection('pf', { employee_rate: v })} />
                                    <NumberField label="Employer Rate %" tooltip="Employer's PF contribution as a percentage of PF wages (includes the EPS portion)." value={c.pf?.employer_rate} onChange={v => updateSection('pf', { employer_rate: v })} />
                                    <NumberField label="EPS Rate %" tooltip="Portion of the employer contribution routed to the Employees' Pension Scheme." value={c.pf?.eps_rate} onChange={v => updateSection('pf', { eps_rate: v })} />
                                    <label className="flex items-center gap-2 col-span-2 mt-5">
                                        <input type="checkbox" checked={!!c.pf?.restrict_to_ceiling} onChange={e => updateSection('pf', { restrict_to_ceiling: e.target.checked })} className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary" />
                                        <span className="text-sm text-fg">Restrict to wage ceiling</span>
                                        <FieldTooltip text="When on, contributions are capped at the ceiling even for higher wages; when off, the full wage is used." />
                                    </label>
                                </>)}
                                {key === 'esi' && (<>
                                    <NumberField label="Wage Ceiling" tooltip="Employees earning at or below this monthly gross are covered by ESI." value={c.esi?.wage_ceiling} onChange={v => updateSection('esi', { wage_ceiling: v })} />
                                    <NumberField label="Employee Rate %" tooltip="Employee's ESI contribution rate." value={c.esi?.employee_rate} onChange={v => updateSection('esi', { employee_rate: v })} />
                                    <NumberField label="Employer Rate %" tooltip="Employer's ESI contribution rate." value={c.esi?.employer_rate} onChange={v => updateSection('esi', { employer_rate: v })} />
                                </>)}
                                {key === 'pt' && (
                                    <div className="col-span-3">
                                        <label className={labelCls}>
                                            State
                                            <FieldTooltip text="Professional Tax slabs differ by state. The engine applies the slab table for the selected state." />
                                        </label>
                                        <input type="text" value={c.pt?.state || ''} onChange={e => updateSection('pt', { state: e.target.value.toUpperCase() })} className={inputCls} placeholder="KL" />
                                        <p className="text-xs text-fg-subtle mt-2">Slab table for the selected state ships as seed data and can be adjusted via import.</p>
                                    </div>
                                )}
                                {key === 'lwf' && (<>
                                    <div>
                                        <label className={labelCls}>State</label>
                                        <input type="text" value={c.lwf?.state || ''} onChange={e => updateSection('lwf', { state: e.target.value.toUpperCase() })} className={inputCls} />
                                    </div>
                                    <NumberField label="Employee Amount" tooltip="Flat LWF amount deducted from the employee per contribution cycle." value={c.lwf?.employee_amount} onChange={v => updateSection('lwf', { employee_amount: v })} />
                                    <NumberField label="Employer Amount" tooltip="Flat LWF amount contributed by the employer per contribution cycle." value={c.lwf?.employer_amount} onChange={v => updateSection('lwf', { employer_amount: v })} />
                                </>)}
                                {key === 'tds' && (<>
                                    <div>
                                        <label className={labelCls}>
                                            Default Regime
                                            <FieldTooltip text="The tax regime applied when an employee has not chosen one. Employees can switch regime on their payroll profile." />
                                        </label>
                                        <Select name="statutorytab-select-23" value={c.tds?.default_regime || 'new'} onChange={e => updateSection('tds', { default_regime: e.target.value })} options={[{ value: "new", label: "New regime" }, { value: "old", label: "Old regime" }]} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>
                                            Slab FY
                                            <FieldTooltip text="Which fiscal year's slab table the engine uses, e.g. 2026-27." />
                                        </label>
                                        <input type="text" value={c.tds?.slabs_fy || ''} onChange={e => updateSection('tds', { slabs_fy: e.target.value })} className={inputCls} placeholder="2026-27" />
                                    </div>
                                    <NumberField label="Standard Deduction" tooltip="Flat deduction from salary income before slabs are applied." value={c.tds?.standard_deduction} onChange={v => updateSection('tds', { standard_deduction: v })} />
                                </>)}
                                {key === 'gratuity' && (
                                    <NumberField label="Rate (days/year)" tooltip="Days of last-drawn wages accrued per completed year of service (statutory default is 15)." value={c.gratuity?.rate_days} onChange={v => updateSection('gratuity', { rate_days: v })} />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Identifiers */}
            <div className="bg-surface border border-line rounded-nb">
                <div className="px-4 py-3 border-b border-line flex items-center">
                    <h4 className="text-sm font-semibold text-fg">Employee Identifiers</h4>
                    <FieldTooltip text="Identifiers collected on each employee's payroll profile. 'Required for payroll' identifiers block an employee from being included in a run until filled." />
                </div>
                <table className="w-full">
                    <thead className="bg-surface-raised/50 border-b border-line">
                        <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Identifier</th>
                            <th className="px-4 py-2.5 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Required for Payroll</th>
                            <th className="px-4 py-2.5 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Masked</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {(c.identifiers || []).map(identifier => (
                            <tr key={identifier.key} className="hover:bg-surface-raised/50 transition-colors">
                                <td className="px-4 py-2.5 text-sm text-fg">
                                    {identifier.label}
                                    <FieldTooltip text={IDENTIFIER_TOOLTIPS[identifier.key] || `${identifier.label} statutory identifier.`} />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                    <input
                                        type="checkbox"
                                        checked={identifier.required_for_payroll}
                                        onChange={e => setConfig(prev => prev ? {
                                            ...prev,
                                            config: {
                                                ...prev.config,
                                                identifiers: (prev.config.identifiers || []).map(i =>
                                                    i.key === identifier.key ? { ...i, required_for_payroll: e.target.checked } : i),
                                            },
                                        } : prev)}
                                        className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary"
                                        aria-label={`${identifier.label} required for payroll`}
                                    />
                                </td>
                                <td className="px-4 py-2.5 text-center text-xs text-fg-muted">{identifier.masked ? 'Yes' : 'No'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end pt-2">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
                >
                    <Save size={14} /> {saving ? 'Saving…' : 'Save Statutory Config'}
                </button>
            </div>
        </div>
    );
};

const NumberField: React.FC<{
    label: string;
    tooltip: string;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
}> = ({ label, tooltip, value, onChange }) => (
    <div>
        <label className={labelCls}>
            {label}
            <FieldTooltip text={tooltip} />
        </label>
        <input
            type="number" min={0} step="0.01"
            value={value ?? ''}
            onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
            className={inputCls}
        />
    </div>
);

export default StatutoryTab;
