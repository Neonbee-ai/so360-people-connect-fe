import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner, Button, Grid, Select, SettingsCard, SettingsPageTemplate, Spinner, Stack, Switch, toast } from '@so360/design-system';
import { Save } from 'lucide-react';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

// Accrual rate/type and carry-forward are deliberately NOT here — leave_types
// already carries accrual_type, carry_forward_allowed, max_carry_forward_days
// and carry_forward_expiry_months PER leave type (Annual Leave and Sick Leave
// legitimately accrue differently), so a single org-wide toggle for either
// would just be a second, conflicting source of truth. Only settings that
// leave_types genuinely cannot express — because they apply to how a leave
// SPAN is calculated across the calendar, not to one type's entitlement —
// belong on this page.
export interface LeaveSettingsValue {
  leave_year_start_month: string;
  weekend_policy: 'exclude' | 'include';
  holiday_inclusion: boolean;
  sandwich_rule: boolean;
  half_day_rule: 'first_half' | 'second_half' | 'both';
  auto_expiry: boolean;
}

export const DEFAULT_LEAVE_SETTINGS: LeaveSettingsValue = {
  leave_year_start_month: 'January',
  weekend_policy: 'exclude',
  holiday_inclusion: false,
  sandwich_rule: false,
  half_day_rule: 'both',
  auto_expiry: false,
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const LeaveSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<LeaveSettingsValue>(DEFAULT_LEAVE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<LeaveSettingsValue>>('leave_policy');
      setValue({ ...DEFAULT_LEAVE_SETTINGS, ...(res.value || {}) });
    } catch {
      toast.error('Failed to load leave settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof LeaveSettingsValue>(field: K, v: LeaveSettingsValue[K]) =>
    setValue((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('leave_policy', value);
      toast.success('Leave settings saved');
    } catch {
      toast.error('Failed to save leave settings');
    } finally {
      setSaving(false);
    }
  };

  const saveAction = canManage ? (
    <Button variant="primary" onClick={handleSave} disabled={saving || loading} className="gap-nb-2">
      <Save className="w-4 h-4" />
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  ) : undefined;

  return (
    <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
      title="Leave Policy"
      description="Leave year and calendar rules applied across every leave type"
      primaryAction={saveAction}
    >
      {loading ? (
        <Spinner aria-label="Loading leave settings..." />
      ) : (
        <Grid columns={2} gap="lg">
          <SettingsCard title="Leave Calendar">
            <Stack gap="default">
              <Select
                name="leave_year_start_month"
                label="Leave Year Start Month"
                value={value.leave_year_start_month}
                onChange={(e) => set('leave_year_start_month', e.target.value)}
                options={MONTHS.map((m) => ({ value: m, label: m }))}
              />
              <Select
                name="weekend_policy"
                label="Weekend Policy"
                value={value.weekend_policy}
                onChange={(e) => set('weekend_policy', e.target.value as LeaveSettingsValue['weekend_policy'])}
                options={[{ value: 'exclude', label: 'Exclude weekends from leave count' }, { value: 'include', label: 'Include weekends in leave count' }]}
              />
              <Select
                name="half_day_rule"
                label="Half Day Rule"
                value={value.half_day_rule}
                onChange={(e) => set('half_day_rule', e.target.value as LeaveSettingsValue['half_day_rule'])}
                options={[{ value: 'first_half', label: 'First half only' }, { value: 'second_half', label: 'Second half only' }, { value: 'both', label: 'Both halves allowed' }]}
              />
            </Stack>
          </SettingsCard>

          <SettingsCard title="Calendar Rules">
            <Stack gap="default">
              <Switch
                name="holiday_inclusion"
                label="Holiday Inclusion (count holidays within a leave span)"
                checked={value.holiday_inclusion}
                onCheckedChange={(v) => set('holiday_inclusion', v)}
              />
              <Switch
                name="sandwich_rule"
                label="Sandwich Rule"
                checked={value.sandwich_rule}
                onCheckedChange={(v) => set('sandwich_rule', v)}
              />
              <Switch
                name="auto_expiry"
                label="Auto Expiry of Unused, Non-Carried Leave at Year End"
                checked={value.auto_expiry}
                onCheckedChange={(v) => set('auto_expiry', v)}
              />
              <Banner variant="info">
                Accrual rate and carry-forward are configured per leave type, not org-wide — different types
                legitimately accrue and carry over differently. Set those in{' '}
                <Link to="/people/leaves/types" className="text-primary underline">
                  Leave Types
                </Link>
                .
              </Banner>
            </Stack>
          </SettingsCard>
        </Grid>
      )}
    </SettingsPageTemplate>
  );
};

export default LeaveSettingsPage;
