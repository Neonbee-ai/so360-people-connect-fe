import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Banner, Button, Cluster, Grid, Select, SettingsCard, SettingsPageTemplate, Spinner, Stack, TextField, toast } from '@so360/design-system';
import { Save, X } from 'lucide-react';
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

const TagListField: React.FC<{
  name: string;
  label: string;
  items: string[];
  placeholder?: string;
  onChange: (items: string[]) => void;
}> = ({ name, label, items, placeholder, onChange }) => {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft('');
  };

  return (
    <Stack gap="tight">
      <Cluster gap="tight">
        <TextField
          name={name}
          label={label}
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
      </Cluster>
      {items.length > 0 && (
        <Cluster gap="tight">
          {items.map((item) => (
            <Badge key={item} tone="primary">
              {item}
              <Button
                variant="ghost"
                size="sm"
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(items.filter((i) => i !== item))}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
        </Cluster>
      )}
    </Stack>
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

  const saveAction = canManage ? (
    <Button variant="primary" onClick={handleSave} disabled={saving || loading} className="gap-nb-2">
      <Save className="w-4 h-4" />
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  ) : undefined;

  return (
    <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
      title="Performance Settings"
      description="Review cycles, KPI categories, and competency library"
      primaryAction={saveAction}
    >
      {loading ? (
        <Spinner aria-label="Loading performance settings..." />
      ) : (
        <Grid columns={2} gap="lg">
          <SettingsCard title="Review Cycle & Rating">
            <Stack gap="default">
              <Select
                name="review_cycle"
                label="Review Cycle"
                value={value.review_cycle}
                onChange={(e) => set('review_cycle', e.target.value as PerformanceSettingsValue['review_cycle'])}
                options={[{ value: 'quarterly', label: 'Quarterly' }, { value: 'half_yearly', label: 'Half-Yearly' }, { value: 'annual', label: 'Annual' }]}
              />
              <Banner variant="info">
                Rating scale and templates are configured per template, not org-wide — different
                reviews legitimately need different scales. Manage those in{' '}
                <Link to="/people/reviews/templates" className="text-primary underline">
                  Review Templates
                </Link>
                .
              </Banner>
            </Stack>
          </SettingsCard>

          <SettingsCard title="Categories & Competencies">
            <Stack gap="default">
              <TagListField
                name="kpi_category_draft"
                label="KPI Categories"
                items={value.kpi_categories}
                placeholder="e.g. Quality of Work"
                onChange={(items) => set('kpi_categories', items)}
              />
              <TagListField
                name="competency_draft"
                label="Competency Library"
                items={value.competency_library}
                placeholder="e.g. Communication"
                onChange={(items) => set('competency_library', items)}
              />
            </Stack>
          </SettingsCard>
        </Grid>
      )}
    </SettingsPageTemplate>
  );
};

export default PerformanceSettingsPage;
