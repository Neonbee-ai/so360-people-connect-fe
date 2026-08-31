import React, { useEffect, useState } from 'react';
import {
  performanceBlocksApi,
  PerformanceBlock,
} from '../services/performanceBlocksService';

/**
 * Measured evidence behind an appraisal.
 *
 * Appraisal conversations were being reconstructed from memory because the
 * numbers lived in CRM. A finalized sales review now pushes a snapshot into
 * People Connect — this is where the reviewer actually reads it.
 *
 * The figures are AS AT the review, never a live re-read. That distinction is
 * shown rather than implied: `computed_at` is on screen, because a reviewer
 * who assumes these are today's numbers will misread a period the person has
 * since recovered from — or been let down by.
 */
export default function PerformanceEvidencePanel({
  personId,
  periodStart,
  periodEnd,
}: {
  personId: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  const [blocks, setBlocks] = useState<PerformanceBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!personId) return;
    setError(null);

    // Wrapped, not just `.catch`: this panel is a child of the appraisal page,
    // and a synchronous throw here (a missing client, a bad import) would take
    // the whole review down with it. Evidence is supporting context — it must
    // never be able to stop someone completing a performance review.
    const load = async () => {
      try {
        const rows = await performanceBlocksApi.list(personId, {
          // Only send a window when BOTH bounds exist — a half-applied filter
          // would silently drop evidence.
          ...(showAll || !periodStart || !periodEnd
            ? {}
            : { period_start: periodStart, period_end: periodEnd }),
        });
        if (!alive) return;
        setBlocks(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (!alive) return;
        setBlocks([]);
        setError(e?.message ?? 'Could not load performance evidence.');
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [personId, periodStart, periodEnd, showAll]);

  if (blocks === null) {
    return (
      <div className="text-sm text-slate-400">Loading performance evidence…</div>
    );
  }

  const scoped = !showAll && periodStart && periodEnd;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">
          Measured performance
        </h3>
        {periodStart && periodEnd && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setShowAll((v) => !v)}
          >
            {scoped ? 'Show all periods' : 'Only this review period'}
          </button>
        )}
      </div>

      {error && <div className="text-sm text-rose-300">{error}</div>}

      {!blocks.length ? (
        <div className="rounded border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          {scoped
            ? 'No measured evidence covering this review period. A CRM sales review pushes it here when it is finalized.'
            : 'No measured evidence for this person yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((b) => {
            const headline = b.payload?.results?.headline;
            const metrics = b.payload?.results?.metrics ?? [];
            const wl = b.payload?.win_loss;
            const actions = b.payload?.action_items ?? [];
            return (
              <div
                key={b.id}
                className="rounded border border-slate-700 bg-slate-800/40 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-slate-200">
                    {b.period_start} → {b.period_end}
                    <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">
                      {b.period_type} · {b.source}
                    </span>
                  </span>
                  {headline?.attainment != null && (
                    <span className="text-sm text-slate-100">
                      {headline.metric}: {Math.round(headline.attainment * 100)}%
                    </span>
                  )}
                </div>

                {metrics.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {metrics.map((m, i) => (
                      <div
                        key={`${b.id}-${i}`}
                        className="flex justify-between gap-6 text-xs"
                      >
                        <span className="text-slate-400">{m.metric}</span>
                        <span className="text-slate-300">
                          {m.actual ?? '—'} / {m.target ?? '—'}
                          {m.attainment != null &&
                            ` · ${Math.round(m.attainment * 100)}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {(wl?.won_count != null || wl?.lost_count != null) && (
                  <div className="mt-2 text-xs text-slate-400">
                    Won {wl?.won_count ?? 0} · Lost {wl?.lost_count ?? 0}
                    {wl?.top_reason?.label
                      ? ` · Top loss reason: ${wl.top_reason.label}`
                      : ''}
                  </div>
                )}

                {actions.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-slate-400">
                    {actions
                      .filter((a) => a?.text)
                      .map((a, i) => (
                        <li key={`${b.id}-a${i}`}>
                          <span className="text-slate-500">{a.kind}: </span>
                          {a.text}
                        </li>
                      ))}
                  </ul>
                )}

                {/* Never presented as live data — see the component note. */}
                <div className="mt-2 text-[11px] text-slate-500">
                  As measured on {String(b.computed_at).slice(0, 10)}; not a
                  live figure.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
