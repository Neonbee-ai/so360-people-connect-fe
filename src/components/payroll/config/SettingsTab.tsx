import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import FieldTooltip from '../FieldTooltip';
import { payrollApi, PayrollSettings } from '../../../services/payrollApi';

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500';
const labelCls = 'block text-xs text-slate-400 mb-1';

const SettingsTab: React.FC = () => {
    const { settings: businessSettings } = useBusinessSettings();
    const [settings, setSettings] = useState<PayrollSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        payrollApi.settings.get()
            .then(setSettings)
            .catch(() => toast.error('Failed to load payroll settings'))
            .finally(() => setLoading(false));
    }, []);

    const update = (field: keyof PayrollSettings, value: unknown) =>
        setSettings(prev => (prev ? { ...prev, [field]: value } : prev));

    const handleSave = async () => {
        if (!settings) return;
        try {
            setSaving(true);
            const saved = await payrollApi.settings.update(settings);
            setSettings(saved);
            toast.success('Payroll settings saved');
        } catch {
            toast.error('Failed to save payroll settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />;
    if (!settings) return <p className="text-sm text-slate-400">Payroll settings are not available yet.</p>;

    return (
        <div className="space-y-5 max-w-2xl">
            <div className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-400">
                Organization currency, timezone and working days come from your organization's
                Business Settings (currency: <span className="text-slate-200 font-medium">{businessSettings?.base_currency || '—'}</span>)
                and cannot be changed here.
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>
                        Pay Frequency
                        <FieldTooltip text="How often employees are paid. v1 supports monthly payroll." />
                    </label>
                    <select value={settings.pay_frequency} onChange={e => update('pay_frequency', e.target.value)} className={inputCls}>
                        <option value="monthly">Monthly</option>
                        <option value="semi_monthly" disabled>Semi-monthly (coming soon)</option>
                        <option value="bi_weekly" disabled>Bi-weekly (coming soon)</option>
                        <option value="weekly" disabled>Weekly (coming soon)</option>
                    </select>
                </div>
                <div>
                    <label className={labelCls}>
                        Pay Day Rule
                        <FieldTooltip text="The day of the month salaries are paid. 'Last working day' skips weekends and holidays." />
                    </label>
                    <select
                        value={settings.pay_day_rule?.type || 'last_working_day'}
                        onChange={e => update('pay_day_rule', e.target.value === 'fixed_day'
                            ? { type: 'fixed_day', day: settings.pay_day_rule?.day || 28 }
                            : { type: 'last_working_day' })}
                        className={inputCls}
                    >
                        <option value="last_working_day">Last working day of the period</option>
                        <option value="fixed_day">Fixed day of the month</option>
                    </select>
                </div>
                {settings.pay_day_rule?.type === 'fixed_day' && (
                    <div>
                        <label className={labelCls}>Pay Day (1–28)</label>
                        <input
                            type="number" min={1} max={28}
                            value={settings.pay_day_rule?.day || 28}
                            onChange={e => update('pay_day_rule', { type: 'fixed_day', day: parseInt(e.target.value) || 28 })}
                            className={inputCls}
                        />
                    </div>
                )}
                <div>
                    <label className={labelCls}>
                        Working Days Basis
                        <FieldTooltip text="How per-day salary is derived: calendar days in the month, actual working days, or a fixed 30-day month." />
                    </label>
                    <select value={settings.working_days_basis} onChange={e => update('working_days_basis', e.target.value)} className={inputCls}>
                        <option value="calendar_days">Calendar days</option>
                        <option value="working_days">Working days</option>
                        <option value="fixed_30">Fixed 30 days</option>
                    </select>
                </div>
                <div>
                    <label className={labelCls}>
                        Loss of Pay (LOP) Basis
                        <FieldTooltip text="What one day of unpaid leave deducts: a day of gross salary, a day of basic salary, or a custom component." />
                    </label>
                    <select value={settings.lop_calculation} onChange={e => update('lop_calculation', e.target.value)} className={inputCls}>
                        <option value="per_day_gross">Per-day gross</option>
                        <option value="per_day_basic">Per-day basic</option>
                        <option value="custom_component">Custom component</option>
                    </select>
                </div>
                <div>
                    <label className={labelCls}>
                        Payslip Number Format
                        <FieldTooltip text="Template for generated payslip numbers, e.g. PS-{YYYY}{MM}-{SEQ}." />
                    </label>
                    <input
                        type="text"
                        value={settings.payslip_number_format || ''}
                        onChange={e => update('payslip_number_format', e.target.value)}
                        placeholder="PS-{YYYY}{MM}-{SEQ}"
                        className={inputCls}
                    />
                </div>
                <div>
                    <label className={labelCls}>
                        Attendance Cutoff Day
                        <FieldTooltip text="Attendance and leave up to this day of the month are considered for the current run; later changes fall into the next run." />
                    </label>
                    <input
                        type="number" min={1} max={31}
                        value={settings.attendance_cutoff_day ?? ''}
                        onChange={e => update('attendance_cutoff_day', e.target.value ? parseInt(e.target.value) : null)}
                        className={inputCls}
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <Save size={14} /> {saving ? 'Saving…' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
};

export default SettingsTab;
