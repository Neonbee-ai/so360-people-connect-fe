import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DetailPageTemplate, EmptyState } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { getContractor360, getEmployee360 } from '../services/peopleService';

/**
 * Employee / Contractor 360 — the people record's cross-module view.
 *
 * Same contract as every other 360: the API composes by person_id from the
 * tables that own each fact, every panel carries a deep link and the
 * permission the UI must check, and a panel the API marks unavailable degrades
 * instead of blanking the page.
 *
 * `kind` decides which endpoint is used: employees have attendance + leave,
 * contractors have worked sessions — same person record, different reality.
 */
type Panel = { available?: boolean; reason?: string; [k: string]: any };

const num = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(n || 0);

export function Employee360Page({ kind = 'employee' }: { kind?: 'employee' | 'contractor' }) {
  // Read the id from the URL: App-level specs mock react-router-dom partially,
  // and a screen must not be the reason the app-level spec breaks.
  const segments = window.location.pathname.split('/').filter(Boolean);
  const personId = segments[1] === 'contractors' ? segments[2] : segments[1];
  const navigate = useNavigate();
  const shell = useShellBridge();
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  const can = useMemo(
    () => (perms?: string[]) => {
      if (!perms?.length) return true;
      if (!shell) return false;
      return perms.some((p) => shell.hasPermission?.(p) ?? false);
    },
    [shell],
  );

  useEffect(() => {
    if (!personId) return;
    let alive = true;
    const load = kind === 'contractor' ? getContractor360 : getEmployee360;
    load(personId)
      .then((res: any) => { if (alive) setData(res); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [personId, kind]);

  const fallbackTitle = kind === 'contractor' ? 'Contractor 360' : 'Employee 360';
  const backToRecord = { id: 'back-to-record', label: 'Back to record', onSelect: () => navigate(`/people/people/${personId}`) };

  if (failed) {
    return (
      <DetailPageTemplate trail={[]} title={fallbackTitle} secondaryActions={[backToRecord]}>
        <EmptyState title="Could not load this 360" description="Try again in a moment." />
      </DetailPageTemplate>
    );
  }
  if (!data) return <DetailPageTemplate trail={[]} title={fallbackTitle} loading />;

  const panels: Record<string, Panel> = data.panels ?? {};
  const attendance = panels.attendance;
  const leave = panels.leave;
  const worked = panels.worked;
  const allocations = panels.allocations;

  return (
    <DetailPageTemplate
      trail={[]}
      title={data.profile?.name || fallbackTitle}
      description={kind === 'contractor' ? 'Contractor 360' : 'Employee 360'}
      secondaryActions={[backToRecord]}
    >
      <div className="flex flex-col gap-nb-3">
      {kind === 'employee' && attendance?.available !== false && (
        <Card title="Attendance — last 30 days">
          <div className="grid grid-cols-2 gap-nb-3 md:grid-cols-5">
            <div><p className="text-xs text-fg-subtle">Days</p><p className="text-lg font-semibold text-fg">{attendance?.days ?? '—'}</p></div>
            <div><p className="text-xs text-fg-subtle">Present</p><p className="text-lg font-semibold text-fg">{attendance?.present ?? '—'}</p></div>
            <div><p className="text-xs text-fg-subtle">Absent</p><p className="text-lg font-semibold text-fg">{attendance?.absent ?? '—'}</p></div>
            <div><p className="text-xs text-fg-subtle">Late</p><p className="text-lg font-semibold text-fg">{attendance?.late ?? '—'}</p></div>
            <div><p className="text-xs text-fg-subtle">Hours</p><p className="text-lg font-semibold text-fg">{num(attendance?.hours)}</p></div>
          </div>
          {can(attendance?.permissions) && (
            <Button variant="ghost" onClick={() => navigate(attendance.deep_link)}>Open attendance register</Button>
          )}
        </Card>
      )}

      {kind === 'employee' && leave?.available !== false && (
        <Card title="Leave">
          <p className="text-sm text-fg">
            {leave?.pending_requests?.length ?? 0} pending request{(leave?.pending_requests?.length ?? 0) === 1 ? '' : 's'}
          </p>
          {can(leave?.permissions) && (
            <Button variant="ghost" onClick={() => navigate(leave.deep_link)}>Open leave</Button>
          )}
        </Card>
      )}

      {kind === 'contractor' && worked?.available !== false && (
        <Card title="Worked sessions">
          <p className="text-sm text-fg">
            {worked?.sessions ?? 0} sessions · {num(worked?.hours)} hours
            {worked?.open ? ` · ${worked.open} open` : ''}
          </p>
          {can(worked?.permissions) && (
            <Button variant="ghost" onClick={() => navigate(worked.deep_link)}>Open time</Button>
          )}
        </Card>
      )}

      {allocations?.available !== false && (
        <Card title="Allocations">
          {allocations?.total === 0 ? (
            <EmptyState title="No allocations" description="Project allocations for this person will appear here." />
          ) : (
            <p className="text-sm text-fg">
              {allocations?.active ?? 0} active of {allocations?.total ?? 0}
            </p>
          )}
          {can(allocations?.permissions) && (
            <Button variant="ghost" onClick={() => navigate(allocations.deep_link)}>Open allocations</Button>
          )}
        </Card>
      )}
      </div>
    </DetailPageTemplate>
  );
}

export default Employee360Page;
