import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, toast, Select } from '@so360/design-system';
import { Award, Save, X, Info } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { settingsApi } from '../../services/orgSettingsService';
import { useShellBridge } from '@so360/shell-context';

// rating_scale and review_templates are deliberately NOT here — the real
// Review Templates page already owns a rating_scale PER template (3/5/10/
// 100-point, review_templates.rating_scale) and IS the actual template
// catalog. A second, org-wide "1-5 or 1-10" scale and a free-text list of
// template names here were pure decoration: nothing ever read them, and a
// template created via that real page could use a scale this page's
// dropdown couldn't even represent (10 or 100-point).
export interface PerformanceSettingsValue {
  review_cycle: 'quarterly' | 'half_yearly' | 'annual';
  kpi_categories: string[];
  competency_library: string[];
}

export const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettingsValue = {
  review_cycle: 'annual',
  kpi_categories: [],
  competency_library: [],
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-bg border border-line rounded-nb text-sm text-fg focus:outline-none focus:border-primary';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs text-fg-muted">{label}</label>
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/30"
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
    return <div className="p-6 text-fg-muted animate-pulse">Loading performance settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Performance Settings"
        subtitle="Review cycles, KPI categories, and competency library"
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
        <div className="bg-surface/50 border border-line rounded-nb p-6 space-y-4">
          <h3 className="text-sm font-bold text-fg-subtle uppercase tracking-widest flex items-center gap-2">
            <Award className="w-4 h-4" /> Review Cycle &amp; Rating
          </h3>

          <Field label="Review Cycle">
            <Select name="performancesettings-select-101" value={value.review_cycle} onChange={(e) => set('review_cycle', e.target.value as PerformanceSettingsValue['review_cycle'])} options={[{ value: "quarterly", label: "Quarterly" }, { value: "half_yearly", label: "Half-Yearly" }, { value: "annual", label: "Annual" }]} />
          </Field>

          <div className="flex items-start gap-2.5 rounded-nb border border-line bg-bg px-3 py-2.5 text-xs text-fg-muted">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-fg-subtle" />
            <span>
              Rating scale and templates are configured per template, not org-wide — different
              reviews legitimately need different scales. Manage those in{' '}
              <Link to="/people/reviews/templates" className="text-primary hover:text-primary underline">
                Review Templates
              </Link>
              .
            </span>
          </div>
        </div>

        <div className="bg-surface/50 border border-line rounded-nb p-6 space-y-4">
          <h3 className="text-sm font-bold text-fg-subtle uppercase tracking-widest">Categories &amp; Competencies</h3>

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
