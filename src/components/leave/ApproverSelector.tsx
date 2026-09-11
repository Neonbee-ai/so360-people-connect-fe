import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Check, X, Star } from 'lucide-react';
import { leaveRequestsApi, type EligibleApprover } from '../../services/leaveRequestsService';

interface ApproverSelectorProps {
  /** The employee the leave is FOR — determines the eligible population. */
  personId: string;
  value: string[];
  onChange: (approverIds: string[]) => void;
  /**
   * Preselect the resolved reporting manager the first time the list loads.
   * Re-preselecting on later loads would fight the user, so it happens once.
   */
  autoSelectSuggested?: boolean;
  label?: string;
  helpText?: string;
  disabled?: boolean;
}

/**
 * "Send Request To" — the multi-approver picker.
 *
 * Selected approvers are held as chips ABOVE the result list, because a search
 * that narrows the list must never hide who is already selected — that is how
 * people end up submitting a request routed somewhere they didn't intend.
 *
 * Search is debounced and served by the backend, which also does the ranking
 * (reporting manager first) and caps the result window. The full employee
 * directory is never loaded into the browser.
 *
 * Selection is by id and de-duplicated by construction (a Set-style toggle), so
 * the same person cannot be added twice; the server enforces the same rule plus
 * self-approval and tenant checks.
 */
const ApproverSelector: React.FC<ApproverSelectorProps> = ({
  personId,
  value,
  onChange,
  autoSelectSuggested = true,
  label = 'Send Request To',
  helpText = 'Select the manager or approver(s) who should review this leave request.',
  disabled = false,
}) => {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<EligibleApprover[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chips must survive a search that excludes them, so selected people are
  // cached by id rather than looked up in the current result page.
  const [known, setKnown] = useState<Record<string, EligibleApprover>>({});
  const autoSelectedRef = useRef(false);
  // `load` is memoised on personId/search, so the `value` it closes over can be
  // stale by the time the response lands. The preselect decision reads this ref
  // instead, which always holds the current selection.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await leaveRequestsApi.getEligibleApprovers(personId, {
        search: debounced || undefined,
        limit: 25,
      });
      setResults(result.data);
      setKnown(prev => {
        const next = { ...prev };
        result.data.forEach(p => { next[p.id] = p; });
        return next;
      });

      // One-shot preselect of the reporting manager. Guarded on the ref rather
      // than on `value.length` so that a user who deliberately clears the
      // suggestion doesn't get it forced back on the next keystroke.
      if (
        autoSelectSuggested &&
        !autoSelectedRef.current &&
        result.suggested_approver_id
      ) {
        autoSelectedRef.current = true;
        if (valueRef.current.length === 0) onChange([result.suggested_approver_id]);
      }
    } catch {
      setResults([]);
      setError('Unable to load approvers. Please try again.');
    } finally {
      setLoading(false);
    }
    // `value`/`onChange` are intentionally omitted — including them would
    // re-run the search on every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, debounced, autoSelectSuggested]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  const selectedPeople = value.map(id => known[id]).filter(Boolean) as EligibleApprover[];

  return (
    <div>
      <label className="mb-1 block text-xs text-slate-400">{label}</label>

      {selectedPeople.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedPeople.map(p => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-teal-500/25 bg-teal-500/10 py-1 pl-2 pr-1 text-xs text-teal-200"
            >
              {p.full_name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-label={`Remove ${p.full_name}`}
                  className="rounded p-0.5 text-teal-300/70 transition-colors hover:bg-teal-500/20 hover:text-teal-100"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={search}
          disabled={disabled}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search manager or employee…"
          aria-label="Search approvers"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-50 focus:border-teal-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800">
        {loading ? (
          <p className="px-3 py-3 text-xs text-slate-500">Loading people…</p>
        ) : error ? (
          <div className="px-3 py-3">
            <p className="text-xs text-rose-400">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-1 text-xs font-medium text-teal-400 hover:text-teal-300"
            >
              Retry
            </button>
          </div>
        ) : results.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-500">
            {debounced ? 'No matching people' : 'No eligible approvers found.'}
          </p>
        ) : (
          results.map(p => {
            const selected = value.includes(p.id);
            return (
              <button
                type="button"
                key={p.id}
                disabled={disabled}
                onClick={() => toggle(p.id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-700/50 disabled:cursor-not-allowed ${selected ? 'bg-teal-500/10' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-slate-50">{p.full_name}</span>
                    {p.is_suggested && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-teal-500/25 px-1 py-px text-[10px] text-teal-300">
                        <Star size={9} />
                        Your manager
                      </span>
                    )}
                  </span>
                  {(p.job_title || p.department_name) && (
                    <span className="block truncate text-xs text-slate-500">
                      {[p.job_title, p.department_name].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                {selected && <Check size={16} className="shrink-0 text-teal-400" />}
              </button>
            );
          })
        )}
      </div>

      <p className="mt-1.5 text-xs text-slate-500">
        {value.length > 0
          ? `All ${value.length} selected approver${value.length === 1 ? '' : 's'} must approve before the leave is granted.`
          : helpText}
      </p>
    </div>
  );
};

export default ApproverSelector;
