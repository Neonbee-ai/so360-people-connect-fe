import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge, Banner, Button, Card, Checkbox, Cluster, Stack, TextField } from '@so360/design-system';
import { leaveConfigApi, type ApplicableLeaveType } from '../../services/leaveConfigService';
import { leaveTypesApi } from '../../services/leaveTypesService';

/**
 * An employee-level deviation from the employment type's defaults, staged in the
 * Add Person form and applied only after the person row exists (overrides are
 * keyed by person_id, which doesn't exist until then).
 */
export interface PendingLeaveOverride {
  leave_type_id: string;
  mode: 'include' | 'exclude';
}

interface PersonLeaveConfigSectionProps {
  /** Master id of the selected employment type; '' when none is selected. */
  employmentTypeMasterId: string;
  employmentTypeName?: string;
  overrides: PendingLeaveOverride[];
  /** Accepts an updater like a React setState, so async callers never write back a stale snapshot. */
  onOverridesChange: (
    next: PendingLeaveOverride[] | ((prev: PendingLeaveOverride[]) => PendingLeaveOverride[]),
  ) => void;
  /** Gates ticking/unticking — creating a person ≠ managing their leave. */
  canManageLeave?: boolean;
  /** Gates creating org-wide leave types from inside the form. */
  canCreateLeaveTypes?: boolean;
}

/** One row of the picker: an active leave type in the org. */
interface LeaveTypeRow {
  id: string;
  name: string;
  color?: string | null;
  max_days_per_year?: number | null;
}

interface NewLeaveTypeDraft {
  name: string;
  days: string;
  isPaid: boolean;
}

/** Common starting set offered when the org has no leave types at all. */
export const QUICK_ADD_PRESETS: NewLeaveTypeDraft[] = [
  { name: 'Annual Leave', days: '18', isPaid: true },
  { name: 'Sick Leave', days: '12', isPaid: true },
  { name: 'Casual Leave', days: '6', isPaid: true },
  { name: 'Unpaid Leave', days: '', isPaid: false },
];

/**
 * Short code for a leave type created from its name: "Annual Leave" → "ANNUAL",
 * "Work From Home" → "WORK_FROM_HOME". The trailing word "leave" is dropped
 * because every type is a leave; a name made only of it keeps it.
 */
export const leaveCodeFromName = (name: string): string => {
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const meaningful = words.filter(w => w !== 'LEAVE');
  return (meaningful.length > 0 ? meaningful : words).join('_').slice(0, 20);
};

/** Returns an error message, or null when the draft can be created. */
export const validateDraft = (draft: NewLeaveTypeDraft): string | null => {
  const name = draft.name.trim();
  if (!name) return 'Enter a name.';
  if (name.length > 100) return 'Keep the name under 100 characters.';
  if (!leaveCodeFromName(name)) return 'Use letters or numbers in the name.';
  if (draft.days.trim() !== '') {
    const days = Number(draft.days);
    if (!Number.isFinite(days) || days < 0) return 'Days per year must be 0 or more.';
  }
  return null;
};

/**
 * Leave Configuration, shown while creating an employee.
 *
 * Every active leave type is a checkbox, pre-ticked from the employment type's
 * defaults. Ticking/unticking never writes to the employment type — adding
 * "Bereavement Leave" for one hire must not hand it to every full-timer — so a
 * deviation is staged as a per-person include/exclude override.
 *
 * An UNCONFIGURED employment type admits EVERY active leave type, so all boxes
 * start ticked; saying so explicitly keeps orgs that never touched leave
 * configuration from thinking their new hire has been locked out.
 *
 * Everything happens in place: this section never navigates, because leaving
 * the page would throw away the half-filled Add Person form. When the org has
 * no leave types at all, they can be created right here.
 */
const PersonLeaveConfigSection: React.FC<PersonLeaveConfigSectionProps> = ({
  employmentTypeMasterId,
  employmentTypeName,
  overrides,
  onOverridesChange,
  canManageLeave = true,
  canCreateLeaveTypes = false,
}) => {
  const [defaults, setDefaults] = useState<ApplicableLeaveType[]>([]);
  const [configured, setConfigured] = useState(false);
  const [catalog, setCatalog] = useState<LeaveTypeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!employmentTypeMasterId) {
      setDefaults([]);
      setConfigured(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [config, types] = await Promise.all([
        leaveConfigApi.getForEmploymentType(employmentTypeMasterId),
        leaveTypesApi.getAll({ is_active: true }),
      ]);
      setDefaults(config.leave_types ?? []);
      setConfigured(config.configured);
      setCatalog(types.data ?? []);
    } catch {
      // Fail visibly. An empty list on a failed read would read as "this
      // employee gets no leave", which is a different fact.
      setDefaults([]);
      setConfigured(false);
      setCatalog([]);
      setError('Could not load the leave types for this employment type.');
    } finally {
      setLoading(false);
    }
  }, [employmentTypeMasterId]);

  useEffect(() => { void load(); }, [load]);

  // Changing employment type re-inherits a different default, so overrides
  // staged against the previous one no longer mean what they meant. They are
  // reset — but never silently.
  const [resetNotice, setResetNotice] = useState(false);
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setResetNotice(overrides.length > 0);
    if (overrides.length > 0) onOverridesChange([]);
    // Only on employment-type change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employmentTypeMasterId]);

  // Catalog first (it is what the org actually has), then any default the
  // catalog didn't return so a configured default is never hidden.
  const rows = useMemo<LeaveTypeRow[]>(() => {
    const seen = new Set(catalog.map(t => t.id));
    return [...catalog, ...defaults.filter(d => !seen.has(d.id))];
  }, [catalog, defaults]);

  const defaultIds = useMemo(() => new Set(defaults.map(d => d.id)), [defaults]);
  const isDefault = (id: string) => !configured || defaultIds.has(id);
  const hasOverride = (id: string, mode: PendingLeaveOverride['mode']) =>
    overrides.some(o => o.leave_type_id === id && o.mode === mode);
  const isChecked = (id: string) =>
    isDefault(id) ? !hasOverride(id, 'exclude') : hasOverride(id, 'include');

  const toggle = (id: string) => {
    const mode = isDefault(id) ? 'exclude' : 'include';
    onOverridesChange(
      hasOverride(id, mode)
        ? overrides.filter(o => !(o.leave_type_id === id && o.mode === mode))
        : [...overrides, { leave_type_id: id, mode }],
    );
  };

  // ── Creating leave types in place ─────────────────────────────────────────
  const [presetPicks, setPresetPicks] = useState<Record<string, boolean>>({});
  const [presetDays, setPresetDays] = useState<Record<string, string>>(
    () => Object.fromEntries(QUICK_ADD_PRESETS.map(p => [p.name, p.days])),
  );
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState<NewLeaveTypeDraft>({ name: '', days: '', isPaid: true });
  const [customError, setCustomError] = useState<string | null>(null);

  /**
   * Creates each draft as an org-wide leave type. Successes join the catalog
   * immediately; a failure is returned per name and the rest still go through.
   */
  const createTypes = async (drafts: NewLeaveTypeDraft[]): Promise<Record<string, string>> => {
    setCreating(true);
    const created: LeaveTypeRow[] = [];
    const failures: Record<string, string> = {};
    for (const draft of drafts) {
      const name = draft.name.trim();
      try {
        const type = await leaveTypesApi.create({
          code: leaveCodeFromName(name),
          name,
          is_paid: draft.isPaid,
          ...(draft.days.trim() !== '' ? { max_days_per_year: Number(draft.days) } : {}),
          is_active: true,
        });
        created.push(type);
      } catch (e) {
        failures[name] = e instanceof Error && e.message ? e.message : 'Could not create this leave type.';
      }
    }
    setCatalog(prev => [...prev, ...created]);
    // A new type is meant for this employee: tick it even when the employment
    // type's configured defaults would leave it out.
    const includes = created
      .filter(t => configured && !defaultIds.has(t.id))
      .map(t => ({ leave_type_id: t.id, mode: 'include' as const }));
    // Functional update: `overrides` was captured before the awaits above, so a
    // tick the user made while creating would be overwritten by writing it back.
    if (includes.length > 0) {
      onOverridesChange(prev => [
        ...prev,
        ...includes.filter(i => !prev.some(o => o.leave_type_id === i.leave_type_id && o.mode === i.mode)),
      ]);
    }
    setPresetPicks(prev => {
      const next = { ...prev };
      for (const t of created) delete next[t.name];
      return next;
    });
    setCreating(false);
    return failures;
  };

  const pickedPresets = QUICK_ADD_PRESETS
    .filter(p => presetPicks[p.name])
    .map(p => ({ ...p, days: presetDays[p.name] }));

  const createPresets = async () => {
    const invalid: Record<string, string> = {};
    for (const p of pickedPresets) {
      const problem = validateDraft(p);
      if (problem) invalid[p.name] = problem;
    }
    if (Object.keys(invalid).length > 0) {
      setCreateErrors(invalid);
      return;
    }
    setCreateErrors(await createTypes(pickedPresets));
  };

  const createCustom = async () => {
    const problem = validateDraft(custom);
    setCustomError(problem);
    if (problem) return;
    const failure = Object.values(await createTypes([custom]))[0];
    if (failure) {
      setCustomError(failure);
      return;
    }
    setCustom({ name: '', days: '', isPaid: true });
    setShowCustom(false);
  };

  const canCreate = canManageLeave && canCreateLeaveTypes;

  const customForm = (
    <Stack gap="tight" data-testid="custom-leave-type-form">
      <Cluster gap="tight">
        <div className="min-w-0 flex-1">
          <TextField
            name="new-leave-type-name"
            aria-label="New leave type name"
            placeholder="Name, e.g. Bereavement Leave"
            value={custom.name}
            onChange={e => setCustom({ ...custom, name: e.target.value })}
          />
        </div>
        <TextField
          name="new-leave-type-days"
          aria-label="New leave type days per year"
          placeholder="Days/yr"
          inputMode="decimal"
          value={custom.days}
          onChange={e => setCustom({ ...custom, days: e.target.value })}
        />
        <Checkbox
          name="new-leave-type-paid"
          label="Paid"
          checked={custom.isPaid}
          onChange={e => setCustom({ ...custom, isPaid: e.target.checked })}
        />
        <Button type="button" size="sm" onClick={() => void createCustom()} disabled={creating}>
          Add
        </Button>
      </Cluster>
      {customError && <p className="text-nb-caption text-danger">{customError}</p>}
    </Stack>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (!employmentTypeMasterId) {
    return (
      <p className="text-nb-body text-fg-subtle">
        Select an Employment Type above to load its leave defaults.
      </p>
    );
  }

  if (loading) {
    return <p className="text-nb-body text-fg-subtle">Loading leave configuration…</p>;
  }

  if (error) {
    return (
      <Banner variant="danger" action={{ label: 'Retry', onClick: () => void load() }}>
        {error}
      </Banner>
    );
  }

  const typeLabel = employmentTypeName || 'This employment type';

  if (rows.length === 0) {
    if (!canCreate) {
      return (
        <Banner variant="info">
          No leave types are set up yet. Ask an HR admin to add them. You can still save this
          person.
        </Banner>
      );
    }
    return (
      <Stack gap="default">
        <p className="text-nb-caption text-fg-muted">
          Your organization has no leave types yet. Add the ones this employee should get:
        </p>

        <Card title="Quick add — common types">
          <Stack gap="tight">
            {QUICK_ADD_PRESETS.map(p => (
              <div key={p.name}>
                <Cluster gap="default">
                  <div className="min-w-0 flex-1">
                    <Checkbox
                      name={`preset-${p.name}`}
                      label={p.name}
                      checked={!!presetPicks[p.name]}
                      onChange={e => setPresetPicks({ ...presetPicks, [p.name]: e.target.checked })}
                    />
                  </div>
                  {p.isPaid ? (
                    <TextField
                      name={`preset-days-${p.name}`}
                      aria-label={`${p.name} days per year`}
                      inputMode="decimal"
                      value={presetDays[p.name]}
                      onChange={e => setPresetDays({ ...presetDays, [p.name]: e.target.value })}
                    />
                  ) : (
                    <span className="text-center text-nb-caption text-fg-subtle">—</span>
                  )}
                  <span className="text-nb-caption text-fg-subtle">{p.isPaid ? 'Paid' : 'Unpaid'}</span>
                </Cluster>
                {createErrors[p.name] && (
                  <p className="text-nb-caption text-danger">{createErrors[p.name]}</p>
                )}
              </div>
            ))}
            <div>
              <Button
                type="button"
                size="sm"
                onClick={() => void createPresets()}
                disabled={creating || pickedPresets.length === 0}
              >
                {creating ? 'Creating…' : `Create selected (${pickedPresets.length})`}
              </Button>
            </div>
          </Stack>
        </Card>

        <Card title="Or add a custom type">
          {customForm}
        </Card>

        <p className="text-nb-caption text-fg-subtle">
          You can skip this. The person can still be saved and leave types assigned later.
        </p>
      </Stack>
    );
  }

  const checkedCount = rows.filter(r => isChecked(r.id)).length;
  const failedNames = Object.keys(createErrors);

  return (
    <Stack gap="default">
      <div className="flex items-start justify-between gap-nb-3">
        <p className="text-nb-caption text-fg-muted">
          {configured ? (
            <>
              Choose the leave types this employee can request. Pre-selected from{' '}
              <span className="text-fg">{typeLabel}</span>.
            </>
          ) : (
            <>
              {typeLabel} has no leave defaults, so all leave types apply. Untick any this employee
              shouldn&apos;t get.
            </>
          )}
        </p>
        <span className="shrink-0 text-nb-caption text-fg-subtle" data-testid="leave-selected-count">
          {checkedCount} of {rows.length} selected
        </span>
      </div>

      {resetNotice && (
        <Banner variant="warning" action={{ label: 'Dismiss', onClick: () => setResetNotice(false) }}>
          The employment type changed, so the default leave types were reloaded and your
          employee-specific changes were cleared. Re-apply them below if they still apply.
        </Banner>
      )}

      {failedNames.length > 0 && (
        <Banner variant="danger">
          {failedNames.map(n => (
            <p key={n}>Couldn&apos;t create {n}: {createErrors[n]}</p>
          ))}
        </Banner>
      )}

      <ul className="divide-y divide-line-strong/60 rounded-nb border border-line-strong bg-surface-raised/50">
        {rows.map(t => {
          const checked = isChecked(t.id);
          const dflt = configured && defaultIds.has(t.id);
          const removed = isDefault(t.id) && !checked;
          const added = !isDefault(t.id) && checked;
          return (
            <li key={t.id} className="flex items-center gap-nb-3 p-nb-3">
              <div className="min-w-0 flex-1">
                <Checkbox
                  name={`leave-type-${t.id}`}
                  label={t.name}
                  checked={checked}
                  disabled={!canManageLeave}
                  onChange={() => toggle(t.id)}
                />
              </div>
              {t.color && (
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
              )}
              {t.max_days_per_year != null && (
                <span className="shrink-0 text-nb-caption text-fg-subtle">{t.max_days_per_year} days</span>
              )}
              {dflt && <Badge tone="neutral" size="sm">Default</Badge>}
              {removed && <Badge tone="warning" size="sm">Removed</Badge>}
              {added && <Badge tone="primary" size="sm">Added</Badge>}
            </li>
          );
        })}
      </ul>

      <Cluster gap="default">
        {canManageLeave && overrides.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onOverridesChange([])}>
            Reset to {employmentTypeName || 'employment type'} defaults
          </Button>
        )}
        {canCreate && !showCustom && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowCustom(true)}>
            <Plus size={13} />
            New leave type
          </Button>
        )}
      </Cluster>

      {canCreate && showCustom && customForm}

      <p className="text-nb-caption text-fg-subtle">
        {canManageLeave
          ? 'Changes apply to this employee only.'
          : 'You can view but not change the leave types for this employee.'}
      </p>
    </Stack>
  );
};

export default PersonLeaveConfigSection;
