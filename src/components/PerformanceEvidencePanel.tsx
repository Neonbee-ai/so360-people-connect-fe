import React, { useEffect, useState } from 'react';
import { Button, Card, Stack, Cluster, Skeleton } from '@so360/design-system';
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
      <Stack gap="tight">
        <span className="text-nb-body text-fg-muted">Loading performance evidence…</span>
        <Skeleton variant="rect" className="h-nb-12 w-full" />
      </Stack>
    );
  }

  const scoped = !showAll && periodStart && periodEnd;

  return (
    <Stack>
      <Cluster justify="between">
        <h3 className="text-nb-label text-fg">Measured performance</h3>
        {periodStart && periodEnd && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {scoped ? 'Show all periods' : 'Only this review period'}
          </Button>
        )}
      </Cluster>

      {error && <p role="alert" className="text-nb-body text-danger">{error}</p>}

      {!blocks.length ? (
        <Card>
          <p className="text-nb-body text-fg-muted">
            {scoped
              ? 'No measured evidence covering this review period. A CRM sales review pushes it here when it is finalized.'
              : 'No measured evidence for this person yet.'}
          </p>
        </Card>
      ) : (
        <Stack>
          {blocks.map((b) => {
            const headline = b.payload?.results?.headline;
            const metrics = b.payload?.results?.metrics ?? [];
            const wl = b.payload?.win_loss;
            const actions = b.payload?.action_items ?? [];
            return (
              <Card key={b.id}>
                <Stack gap="tight">
                  <Cluster justify="between">
                    <span className="text-nb-body text-fg">
                      {b.period_start} → {b.period_end}
                      <span className="text-nb-caption text-fg-subtle">
                        {' '}{b.period_type} · {b.source}
                      </span>
                    </span>
                    {headline?.attainment != null && (
                      <span className="text-nb-body text-fg">
                        {headline.metric}: {Math.round(headline.attainment * 100)}%
                      </span>
                    )}
                  </Cluster>

                  {metrics.length > 0 && (
                    <Stack gap="none">
                      {metrics.map((m, i) => (
                        <Cluster key={`${b.id}-${i}`} justify="between">
                          <span className="text-nb-caption text-fg-muted">{m.metric}</span>
                          <span className="text-nb-caption text-fg">
                            {m.actual ?? '—'} / {m.target ?? '—'}
                            {m.attainment != null &&
                              ` · ${Math.round(m.attainment * 100)}%`}
                          </span>
                        </Cluster>
                      ))}
                    </Stack>
                  )}

                  {(wl?.won_count != null || wl?.lost_count != null) && (
                    <div className="text-nb-caption text-fg-muted">
                      Won {wl?.won_count ?? 0} · Lost {wl?.lost_count ?? 0}
                      {wl?.top_reason?.label
                        ? ` · Top loss reason: ${wl.top_reason.label}`
                        : ''}
                    </div>
                  )}

                  {actions.length > 0 && (
                    <ul className="list-disc pl-nb-4 text-nb-caption text-fg-muted">
                      {actions
                        .filter((a) => a?.text)
                        .map((a, i) => (
                          <li key={`${b.id}-a${i}`}>
                            <span className="text-fg-subtle">{a.kind}: </span>
                            {a.text}
                          </li>
                        ))}
                    </ul>
                  )}

                  {/* Never presented as live data — see the component note. */}
                  <div className="text-nb-caption text-fg-subtle">
                    As measured on {String(b.computed_at).slice(0, 10)}; not a
                    live figure.
                  </div>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
