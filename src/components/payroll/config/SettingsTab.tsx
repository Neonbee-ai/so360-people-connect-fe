import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
    toast, Alert, Button, Cluster, FieldGrid, NumberInput, Select, Skeleton, Stack, TextField, EmptyState,
} from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { payrollApi, PayrollSettings } from '../../../services/payrollApi';

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

    if (loading) return <Skeleton variant="text" lines={6} />;
    if (!settings) return <EmptyState title="Payroll settings are not available yet." />;

    return (
        <Stack>
            <Alert variant="info">
                Organization currency, timezone and working days come from your organization's
                Business Settings (currency: <span className="font-medium">{businessSettings?.base_currency || '—'}</span>)
                and cannot be changed here.
            </Alert>

            <FieldGrid columns={2}>
                <Select
                    name="payroll-pay-frequency"
                    label="Pay Frequency"
                    hint="How often employees are paid. v1 supports monthly payroll."
                    value={settings.pay_frequency}
                    onChange={e => update('pay_frequency', e.target.value)}
                    options={[{ value: 'monthly', label: 'Monthly' }, { value: 'semi_monthly', label: 'Semi-monthly (coming soon)', disabled: true }, { value: 'bi_weekly', label: 'Bi-weekly (coming soon)', disabled: true }, { value: 'weekly', label: 'Weekly (coming soon)', disabled: true }]}
                />
                <Select
                    name="payroll-pay-day-rule"
                    label="Pay Day Rule"
                    hint="The day of the month salaries are paid. 'Last working day' skips weekends and holidays."
                    value={settings.pay_day_rule?.type || 'last_working_day'}
                    onChange={e => update('pay_day_rule', e.target.value === 'fixed_day'
                        ? { type: 'fixed_day', day: settings.pay_day_rule?.day || 28 }
                        : { type: 'last_working_day' })}
                    options={[{ value: 'last_working_day', label: 'Last working day of the period' }, { value: 'fixed_day', label: 'Fixed day of the month' }]}
                />
                {settings.pay_day_rule?.type === 'fixed_day' && (
                    <NumberInput
                        name="payroll-pay-day"
                        label="Pay Day (1–28)"
                        min={1}
                        max={28}
                        value={settings.pay_day_rule?.day || 28}
                        onChange={v => update('pay_day_rule', { type: 'fixed_day', day: v || 28 })}
                    />
                )}
                <Select
                    name="payroll-working-days-basis"
                    label="Working Days Basis"
                    hint="How per-day salary is derived: calendar days in the month, actual working days, or a fixed 30-day month."
                    value={settings.working_days_basis}
                    onChange={e => update('working_days_basis', e.target.value)}
                    options={[{ value: 'calendar_days', label: 'Calendar days' }, { value: 'working_days', label: 'Working days' }, { value: 'fixed_30', label: 'Fixed 30 days' }]}
                />
                <Select
                    name="payroll-lop-basis"
                    label="Loss of Pay (LOP) Basis"
                    hint="What one day of unpaid leave deducts: a day of gross salary, a day of basic salary, or a custom component."
                    value={settings.lop_calculation}
                    onChange={e => update('lop_calculation', e.target.value)}
                    options={[{ value: 'per_day_gross', label: 'Per-day gross' }, { value: 'per_day_basic', label: 'Per-day basic' }, { value: 'custom_component', label: 'Custom component' }]}
                />
                <TextField
                    name="payroll-payslip-number-format"
                    label="Payslip Number Format"
                    hint="Template for generated payslip numbers, e.g. PS-{YYYY}{MM}-{SEQ}."
                    value={settings.payslip_number_format || ''}
                    onChange={e => update('payslip_number_format', e.target.value)}
                    placeholder="PS-{YYYY}{MM}-{SEQ}"
                />
                <NumberInput
                    name="payroll-attendance-cutoff-day"
                    label="Attendance Cutoff Day"
                    hint="Attendance and leave up to this day of the month are considered for the current run; later changes fall into the next run."
                    min={1}
                    max={31}
                    value={settings.attendance_cutoff_day ?? null}
                    onChange={v => update('attendance_cutoff_day', v ?? null)}
                />
            </FieldGrid>

            <Cluster justify="end">
                <Button onClick={handleSave} disabled={saving}>
                    <Save size={14} /> {saving ? 'Saving…' : 'Save Settings'}
                </Button>
            </Cluster>
        </Stack>
    );
};

export default SettingsTab;
