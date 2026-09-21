import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '@so360/design-system';
import { Hash, Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
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

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-blue-600';

const preview = (rule: NumberingRule) => `${rule.prefix}${String(1).padStart(rule.padding, '0')}`;

const RuleGroup: React.FC<{
  title: string;
  rule: NumberingRule;
  onChange: (rule: NumberingRule) => void;
}> = ({ title, rule, onChange }) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label className="text-xs text-slate-400">Prefix</label>
        <input
          type="text"
          className={INPUT_CLASS}
          value={rule.prefix}
          onChange={(e) => onChange({ ...rule, prefix: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-slate-400">Padding (digits)</label>
        <input
          type="number"
          min={1}
          max={10}
          className={INPUT_CLASS}
          value={rule.padding}
          onChange={(e) => onChange({ ...rule, padding: parseInt(e.target.value, 10) || 1 })}
        />
      </div>
    </div>
    <div className="text-xs text-slate-500">
      Preview: <span className="font-mono text-blue-400">{preview(rule)}</span>
    </div>
  </div>
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

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading numbering settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Numbering & Prefixes"
        subtitle="Auto-generated ID formats used across People Connect"
        actions={
          canManage && (
            <Button variant="primary" onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RuleGroup title="Employee ID" rule={value.employee} onChange={(r) => setValue((p) => ({ ...p, employee: r }))} />
        <RuleGroup title="Department Code" rule={value.department} onChange={(r) => setValue((p) => ({ ...p, department: r }))} />
        <RuleGroup title="Leave Request Number" rule={value.leave} onChange={(r) => setValue((p) => ({ ...p, leave: r }))} />
        <RuleGroup title="Review Number" rule={value.review} onChange={(r) => setValue((p) => ({ ...p, review: r }))} />
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Hash className="w-3.5 h-3.5" />
        <span>Changes apply to new records only. Existing IDs are never renumbered.</span>
      </div>
    </div>
  );
};

export default NumberingSettingsPage;
