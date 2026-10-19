import React, { useCallback, useEffect, useState } from 'react';
import { Button, Cluster, FieldGrid, Grid, NumberInput, SettingsCard, SettingsPageTemplate, Spinner, TextField, toast } from '@so360/design-system';
import { Hash, Save } from 'lucide-react';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

export interface NumberingRule {
  prefix: string;
  padding: number;
}

export interface NumberingSettingsValue {
  employee: NumberingRule;
  department: NumberingRule;
  leave: NumberingRule;
  review: NumberingRule;
}

export const DEFAULT_NUMBERING_SETTINGS: NumberingSettingsValue = {
  employee: { prefix: 'EMP-', padding: 5 },
  department: { prefix: 'DEPT-', padding: 3 },
  leave: { prefix: 'LV-', padding: 5 },
  review: { prefix: 'REV-', padding: 4 },
};

const preview = (rule: NumberingRule) => `${rule.prefix}${String(1).padStart(rule.padding, '0')}`;

const RuleGroup: React.FC<{
  title: string;
  name: string;
  rule: NumberingRule;
  onChange: (rule: NumberingRule) => void;
}> = ({ title, name, rule, onChange }) => (
  <SettingsCard title={title}>
    <FieldGrid columns={2}>
      <TextField
        name={`${name}-prefix`}
        label="Prefix"
        value={rule.prefix}
        onChange={(e) => onChange({ ...rule, prefix: e.target.value })}
      />
      <NumberInput
        name={`${name}-padding`}
        label="Padding (digits)"
        min={1}
        max={10}
        value={rule.padding}
        onChange={(n) => onChange({ ...rule, padding: n || 1 })}
      />
    </FieldGrid>
    <div className="text-nb-caption text-fg-subtle">
      Preview: <span className="font-mono text-primary">{preview(rule)}</span>
    </div>
  </SettingsCard>
);

const NumberingSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<NumberingSettingsValue>(DEFAULT_NUMBERING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<NumberingSettingsValue>>('numbering');
      setValue({ ...DEFAULT_NUMBERING_SETTINGS, ...(res.value || {}) });
    } catch {
      toast.error('Failed to load numbering settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('numbering', value);
      toast.success('Numbering settings saved');
    } catch {
      toast.error('Failed to save numbering settings');
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
    <SettingsPageTemplate
      title="Numbering & Prefixes"
      description="Auto-generated ID formats used across People Connect"
      primaryAction={saveAction}
    >
      {loading ? (
        <Spinner aria-label="Loading numbering settings..." />
      ) : (
        <>
          <Grid columns={2} gap="lg">
            <RuleGroup title="Employee ID" name="employee" rule={value.employee} onChange={(r) => setValue((p) => ({ ...p, employee: r }))} />
            <RuleGroup title="Department Code" name="department" rule={value.department} onChange={(r) => setValue((p) => ({ ...p, department: r }))} />
            <RuleGroup title="Leave Request Number" name="leave" rule={value.leave} onChange={(r) => setValue((p) => ({ ...p, leave: r }))} />
            <RuleGroup title="Review Number" name="review" rule={value.review} onChange={(r) => setValue((p) => ({ ...p, review: r }))} />
          </Grid>

          <Cluster gap="tight" align="center" className="text-nb-caption text-fg-subtle">
            <Hash className="w-3.5 h-3.5" />
            <span>Changes apply to new records only. Existing IDs are never renumbered.</span>
          </Cluster>
        </>
      )}
    </SettingsPageTemplate>
  );
};

export default NumberingSettingsPage;
