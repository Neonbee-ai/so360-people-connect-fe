import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
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

const inputClass =
  'rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-50 focus:border-teal-500 focus:outline-none';

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
    <div className="space-y-1.5" data-testid="custom-leave-type-form">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="New leave type name"
          placeholder="Name, e.g. Bereavement Leave"
          value={custom.name}
          onChange={e => setCustom({ ...custom, name: e.target.value })}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <input
          aria-label="New leave type days per year"
          placeholder="Days/yr"
          inputMode="decimal"
          value={custom.days}
          onChange={e => setCustom({ ...custom, days: e.target.value })}
          className={`${inputClass} w-20`}
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={custom.isPaid}
            onChange={e => setCustom({ ...custom, isPaid: e.target.checked })}
          />
          Paid
        </label>
        <button
          type="button"
          onClick={() => void createCustom()}
          disabled={creating}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {customError && <p className="text-xs text-rose-300">{customError}</p>}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (!employmentTypeMasterId) {
    return (
      <p className="text-sm text-slate-500">
        Select an Employment Type above to load its leave defaults.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading leave configuration…</p>;
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-rose-700/40 bg-rose-900/20 px-3 py-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-400" />
        <div className="text-xs text-rose-300">
          {error}{' '}
          <button
            type="button"
            onClick={() => void load()}
            className="font-medium underline hover:text-rose-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const typeLabel = employmentTypeName || 'This employment type';

  if (rows.length === 0) {
    if (!canCreate) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <p className="text-xs text-slate-400">
            No leave types are set up yet. Ask an HR admin to add them. You can still save this
            person.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          Your organization has no leave types yet. Add the ones this employee should get:
        </p>

        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Quick add — common types
          </p>
          <ul className="space-y-1.5">
            {QUICK_ADD_PRESETS.map(p => (
              <li key={p.name} className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={!!presetPicks[p.name]}
                      onChange={e => setPresetPicks({ ...presetPicks, [p.name]: e.target.checked })}
                    />
                    {p.name}
                  </label>
                  {p.isPaid ? (
                    <input
                      aria-label={`${p.name} days per year`}
                      inputMode="decimal"
                      value={presetDays[p.name]}
                      onChange={e => setPresetDays({ ...presetDays, [p.name]: e.target.value })}
                      className={`${inputClass} w-16`}
                    />
                  ) : (
                    <span className="w-16 text-center text-xs text-slate-500">—</span>
                  )}
                  <span className="w-12 text-xs text-slate-500">{p.isPaid ? 'Paid' : 'Unpaid'}</span>
                </div>
                {createErrors[p.name] && (
                  <p className="pl-6 text-xs text-rose-300">{createErrors[p.name]}</p>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void createPresets()}
            disabled={creating || pickedPresets.length === 0}
            className="mt-3 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {creating ? 'Creating…' : `Create selected (${pickedPresets.length})`}
          </button>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Or add a custom type
          </p>
          {customForm}
        </div>

        <p className="text-xs text-slate-500">
          You can skip this. The person can still be saved and leave types assigned later.
        </p>
      </div>
    );
  }

  const checkedCount = rows.filter(r => isChecked(r.id)).length;
  const failedNames = Object.keys(createErrors);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-slate-400">
          {configured ? (
            <>
              Choose the leave types this employee can request. Pre-selected from{' '}
              <span className="text-slate-300">{typeLabel}</span>.
            </>
          ) : (
            <>
              {typeLabel} has no leave defaults, so all leave types apply. Untick any this employee
              shouldn&apos;t get.
            </>
          )}
        </p>
        <span className="shrink-0 text-xs text-slate-500" data-testid="leave-selected-count">
          {checkedCount} of {rows.length} selected
        </span>
      </div>

      {resetNotice && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-200">
            The employment type changed, so the default leave types were reloaded and your
            employee-specific changes were cleared. Re-apply them below if they still apply.
            <button
              type="button"
              onClick={() => setResetNotice(false)}
              className="ml-1 font-medium underline hover:text-amber-100"
            >
              Dismiss
            </button>
          </p>
        </div>
      )}

      {failedNames.length > 0 && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
          {failedNames.map(n => (
            <p key={n}>Couldn&apos;t create {n}: {createErrors[n]}</p>
          ))}
        </div>
      )}

      <ul className="divide-y divide-slate-700/60 rounded-lg border border-slate-700 bg-slate-800/50">
        {rows.map(t => {
          const checked = isChecked(t.id);
          const dflt = configured && defaultIds.has(t.id);
          const removed = isDefault(t.id) && !checked;
          const added = !isDefault(t.id) && checked;
          return (
            <li key={t.id}>
              <label
                className={`flex items-center gap-2 px-3 py-2 ${canManageLeave ? 'cursor-pointer hover:bg-slate-800' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canManageLeave}
                  onChange={() => toggle(t.id)}
                />
                {t.color && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                )}
                <span className={`min-w-0 flex-1 truncate text-sm ${checked ? 'text-slate-200' : 'text-slate-500'}`}>
                  {t.name}
                </span>
                {t.max_days_per_year != null && (
                  <span className="shrink-0 text-xs text-slate-500">{t.max_days_per_year} days</span>
                )}
                {dflt && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">Default</span>
                )}
                {removed && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-amber-400">Removed</span>
                )}
                {added && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-teal-400">Added</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {canManageLeave && overrides.length > 0 && (
          <button
            type="button"
            onClick={() => onOverridesChange([])}
            className="text-xs font-medium text-teal-400 hover:text-teal-300"
          >
            Reset to {employmentTypeName || 'employment type'} defaults
          </button>
        )}
        {canCreate && !showCustom && (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300"
          >
            <Plus size={13} />
            New leave type
          </button>
        )}
      </div>

      {canCreate && showCustom && customForm}

      <p className="text-xs text-slate-500">
        {canManageLeave
          ? 'Changes apply to this employee only.'
          : 'You can view but not change the leave types for this employee.'}
      </p>
    </div>
  );
};

export default PersonLeaveConfigSection;
