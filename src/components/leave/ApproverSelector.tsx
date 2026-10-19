import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X, Star } from 'lucide-react';
import { Badge, Button, IconButton, SearchInput, Stack, Cluster } from '@so360/design-system';
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
    <Stack gap="tight">
      <span className="text-nb-caption text-fg-muted">{label}</span>

      {selectedPeople.length > 0 && (
        <Cluster gap="tight">
          {selectedPeople.map(p => (
            <Badge key={p.id} tone="primary">
              {p.full_name}
              {!disabled && (
                <IconButton
                  label={`Remove ${p.full_name}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => toggle(p.id)}
                  icon={<X size={12} />}
                />
              )}
            </Badge>
          ))}
        </Cluster>
      )}

      <SearchInput
        name="approver-search"
        value={search}
        disabled={disabled}
        onChange={setSearch}
        placeholder="Search manager or employee…"
        aria-label="Search approvers"
      />

      <div className="max-h-48 overflow-y-auto rounded-nb border border-line-strong bg-surface-raised">
        {loading ? (
          <p className="p-nb-3 text-nb-caption text-fg-subtle">Loading people…</p>
        ) : error ? (
          <div className="p-nb-3">
            <p className="text-nb-caption text-danger">{error}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : results.length === 0 ? (
          <p className="p-nb-3 text-nb-caption text-fg-subtle">
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
                className={`flex w-full items-center gap-nb-3 p-nb-3 text-left text-nb-body transition-colors hover:bg-line/50 disabled:cursor-not-allowed ${selected ? 'bg-primary/10' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-nb-2">
                    <span className="truncate text-fg">{p.full_name}</span>
                    {p.is_suggested && (
                      <Badge tone="primary" size="sm">
                        <Star size={9} />
                        Your manager
                      </Badge>
                    )}
                  </span>
                  {(p.job_title || p.department_name) && (
                    <span className="block truncate text-nb-caption text-fg-subtle">
                      {[p.job_title, p.department_name].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                {selected && <Check size={16} className="shrink-0 text-primary" />}
              </button>
            );
          })
        )}
      </div>

      <p className="text-nb-caption text-fg-subtle">
        {value.length > 0
          ? `All ${value.length} selected approver${value.length === 1 ? '' : 's'} must approve before the leave is granted.`
          : helpText}
      </p>
    </Stack>
  );
};

export default ApproverSelector;
