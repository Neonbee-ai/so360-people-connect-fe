import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, AlertTriangle } from 'lucide-react';
import { leaveConfigApi, type ApplicableLeaveType } from '../../services/leaveConfigService';
import { leaveTypesApi, type LeaveType } from '../../services/leaveTypesService';

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
  onOverridesChange: (next: PendingLeaveOverride[]) => void;
  /** Gates the customise affordance — creating a person ≠ managing their leave. */
  canManageLeave?: boolean;
  onConfigureEmploymentTypes?: () => void;
}

/**
 * Leave Configuration, shown while creating an employee.
 *
 * This section is a VIEW of the employment type's configured defaults plus a
 * staging area for employee-specific deviations. It never writes to the
 * employment type — adding "Bereavement Leave" for one hire must not hand it to
 * every full-timer, which is why customisation is modelled as per-person
 * include/exclude overrides rather than an edit of the inherited list.
 *
 * The `inherits_all` / `configured: false` case is genuinely different from
 * "this employee gets nothing": an unconfigured employment type admits EVERY
 * active leave type. Saying so explicitly is what keeps orgs that never touched
 * leave configuration from thinking their new hire has been locked out.
 */
const PersonLeaveConfigSection: React.FC<PersonLeaveConfigSectionProps> = ({
  employmentTypeMasterId,
  employmentTypeName,
  overrides,
  onOverridesChange,
  canManageLeave = true,
  onConfigureEmploymentTypes,
}) => {
  const [inherited, setInherited] = useState<ApplicableLeaveType[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [catalog, setCatalog] = useState<LeaveType[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!employmentTypeMasterId) {
      setInherited([]);
      setConfigured(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await leaveConfigApi.getForEmploymentType(employmentTypeMasterId);
      setInherited(result.leave_types ?? []);
      setConfigured(result.configured);
    } catch {
      // Fail visibly. Showing an empty list on a failed read would read as
      // "this employment type grants no leave", which is a different fact.
      setInherited([]);
      setConfigured(false);
      setError('Could not load the leave structure for this employment type.');
    } finally {
      setLoading(false);
    }
  }, [employmentTypeMasterId]);

  useEffect(() => { void load(); }, [load]);

  // Changing employment type re-inherits a different default, so overrides
  // staged against the previous one no longer mean what they meant (an "exclude
  // Sick Leave" that the new type never granted is nonsense). They are reset —
  // but never silently: `resetNotice` tells the user it happened so a
  // deliberate customisation can't vanish unannounced.
  const [resetNotice, setResetNotice] = useState(false);
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setResetNotice(overrides.length > 0);
    if (overrides.length > 0) onOverridesChange([]);
    setCustomizing(false);
    // Only on employment-type change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employmentTypeMasterId]);

  const openCustomize = async () => {
    setCustomizing(true);
    if (catalog.length === 0) {
      try {
        const result = await leaveTypesApi.getAll({ is_active: true });
        setCatalog(result.data);
      } catch {
        setError('Could not load the leave type list.');
      }
    }
  };

  const excluded = useMemo(
    () => new Set(overrides.filter(o => o.mode === 'exclude').map(o => o.leave_type_id)),
    [overrides],
  );
  const included = useMemo(
    () => overrides.filter(o => o.mode === 'include'),
    [overrides],
  );

  const inheritedIds = useMemo(() => new Set(inherited.map(t => t.id)), [inherited]);

  const addableTypes = catalog.filter(
    t => !inheritedIds.has(t.id) && !included.some(o => o.leave_type_id === t.id),
  );

  const nameFor = (id: string) =>
    catalog.find(t => t.id === id)?.name ?? inherited.find(t => t.id === id)?.name ?? 'Leave type';

  const removeInherited = (id: string) =>
    onOverridesChange([...overrides, { leave_type_id: id, mode: 'exclude' }]);

  const restoreInherited = (id: string) =>
    onOverridesChange(overrides.filter(o => !(o.leave_type_id === id && o.mode === 'exclude')));

  const addType = (id: string) => {
    if (!id) return;
    // Duplicate-proof: already-inherited and already-added types are filtered
    // out of `addableTypes`, and this guard covers a stale select value.
    if (inheritedIds.has(id) || included.some(o => o.leave_type_id === id)) return;
    onOverridesChange([...overrides, { leave_type_id: id, mode: 'include' }]);
    setAdding(false);
  };

  const removeAdded = (id: string) =>
    onOverridesChange(overrides.filter(o => !(o.leave_type_id === id && o.mode === 'include')));

  if (!employmentTypeMasterId) {
    return (
      <p className="text-sm text-slate-500">
        Select an Employment Type to load the default leave structure.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading leave configuration…</p>;
  }

  const activeInherited = inherited.filter(t => !excluded.has(t.id));
  const totalApplying = configured ? activeInherited.length + included.length : null;

  return (
    <div className="space-y-3">
      {error && (
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
      )}

      <p className="text-xs text-slate-500">
        Configure the leave types applicable to this employee. Defaults come from the selected
        employment type.
      </p>

      {resetNotice && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-200">
            The employment type changed, so the default leave structure was reloaded and your
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

      {!configured && !error ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-3">
          <p className="text-sm text-slate-300">
            No leave types are configured for
            {employmentTypeName ? ` ${employmentTypeName}` : ' this employment type'}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Every active leave type will apply to this employee. To narrow that, configure the
            employment type's defaults.
          </p>
          {onConfigureEmploymentTypes && canManageLeave && (
            <button
              type="button"
              onClick={onConfigureEmploymentTypes}
              className="mt-2 text-xs font-medium text-teal-400 underline hover:text-teal-300"
            >
              Configure Leave Types
            </button>
          )}
        </div>
      ) : (
        !error && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Based on: <span className="text-slate-300">{employmentTypeName || 'Employment type'}</span>
              </p>
              <span className="text-xs text-slate-500">
                {totalApplying} leave type{totalApplying === 1 ? '' : 's'}
              </span>
            </div>

            <ul className="space-y-1.5">
              {inherited.map(t => {
                const isExcluded = excluded.has(t.id);
                return (
                  <li
                    key={t.id}
                    className={`flex items-center justify-between gap-2 rounded border border-slate-700/60 px-2.5 py-1.5 ${isExcluded ? 'opacity-50' : ''}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {t.color && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                      )}
                      <span className={`truncate text-sm ${isExcluded ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {t.name}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
                        Employment type
                      </span>
                      {t.max_days_per_year != null && (
                        <span className="shrink-0 text-xs text-slate-500">
                          {t.max_days_per_year} days
                        </span>
                      )}
                    </span>
                    {customizing && canManageLeave && (
                      <button
                        type="button"
                        onClick={() => (isExcluded ? restoreInherited(t.id) : removeInherited(t.id))}
                        className="shrink-0 text-xs font-medium text-slate-400 hover:text-slate-200"
                      >
                        {isExcluded ? 'Restore' : 'Remove'}
                      </button>
                    )}
                  </li>
                );
              })}

              {included.map(o => (
                <li
                  key={o.leave_type_id}
                  className="flex items-center justify-between gap-2 rounded border border-teal-500/25 bg-teal-500/5 px-2.5 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-slate-200">{nameFor(o.leave_type_id)}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-teal-400">
                      This employee only
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAdded(o.leave_type_id)}
                    aria-label={`Remove ${nameFor(o.leave_type_id)}`}
                    className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-200"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>

            {!customizing ? (
              canManageLeave && (
                <button
                  type="button"
                  onClick={() => void openCustomize()}
                  className="mt-2.5 text-xs font-medium text-teal-400 hover:text-teal-300"
                >
                  Customize for this employee
                </button>
              )
            ) : (
              <div className="mt-2.5">
                {adding ? (
                  <select
                    autoFocus
                    defaultValue=""
                    onChange={e => addType(e.target.value)}
                    onBlur={() => setAdding(false)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      {addableTypes.length > 0 ? 'Select a leave type…' : 'No other leave types available'}
                    </option>
                    {addableTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300"
                  >
                    <Plus size={13} />
                    Add Leave Type
                  </button>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Changes here apply to this employee only — the {employmentTypeName || 'employment type'}{' '}
                  default is unchanged.
                </p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default PersonLeaveConfigSection;
