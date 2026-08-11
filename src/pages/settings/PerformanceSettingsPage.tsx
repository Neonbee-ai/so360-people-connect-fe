import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '@so360/design-system';
import { Award, Save, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

export interface PerformanceSettingsValue {
  review_cycle: 'quarterly' | 'half_yearly' | 'annual';
  rating_scale: '1-5' | '1-10';
  kpi_categories: string[];
  competency_library: string[];
  review_templates: string[];
}

export const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettingsValue = {
  review_cycle: 'annual',
  rating_scale: '1-5',
  kpi_categories: [],
  competency_library: [],
  review_templates: [],
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-blue-600';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs text-slate-400">{label}</label>
    {children}
  </div>
);

const TagListField: React.FC<{
  label: string;
  items: string[];
  placeholder?: string;
  onChange: (items: string[]) => void;
}> = ({ label, items, placeholder, onChange }) => {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft('');
  };

  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="text"
          className={INPUT_CLASS}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button variant="secondary" type="button" onClick={addItem}>Add</Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-blue-600/10 text-blue-400 border border-blue-600/30"
            >
              {item}
              <button type="button" onClick={() => onChange(items.filter((i) => i !== item))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
};

const PerformanceSettingsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:settings:manage') ?? true);

  const [value, setValue] = useState<PerformanceSettingsValue>(DEFAULT_PERFORMANCE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get<Partial<PerformanceSettingsValue>>('performance_settings');
      setValue({ ...DEFAULT_PERFORMANCE_SETTINGS, ...(res.value || {}) });
    } catch {
      toast.error('Failed to load performance settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof PerformanceSettingsValue>(field: K, v: PerformanceSettingsValue[K]) =>
    setValue((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.update('performance_settings', value);
      toast.success('Performance settings saved');
    } catch {
      toast.error('Failed to save performance settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading performance settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Performance Settings"
        subtitle="Review cycles, rating scale, KPI categories, and competency library"
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
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Award className="w-4 h-4" /> Review Cycle &amp; Rating
          </h3>

          <Field label="Review Cycle">
            <select
              className={INPUT_CLASS}
              value={value.review_cycle}
              onChange={(e) => set('review_cycle', e.target.value as PerformanceSettingsValue['review_cycle'])}
            >
              <option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half-Yearly</option>
              <option value="annual">Annual</option>
            </select>
          </Field>

          <Field label="Rating Scale">
            <select
              className={INPUT_CLASS}
              value={value.rating_scale}
              onChange={(e) => set('rating_scale', e.target.value as PerformanceSettingsValue['rating_scale'])}
            >
              <option value="1-5">1 to 5</option>
              <option value="1-10">1 to 10</option>
            </select>
          </Field>

          <TagListField
            label="Review Templates"
            items={value.review_templates}
            placeholder="e.g. Annual Manager Review"
            onChange={(items) => set('review_templates', items)}
          />
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Categories &amp; Competencies</h3>

          <TagListField
            label="KPI Categories"
            items={value.kpi_categories}
            placeholder="e.g. Quality of Work"
            onChange={(items) => set('kpi_categories', items)}
          />

          <TagListField
            label="Competency Library"
            items={value.competency_library}
            placeholder="e.g. Communication"
            onChange={(items) => set('competency_library', items)}
          />
        </div>
      </div>
    </div>
  );
};

export default PerformanceSettingsPage;
