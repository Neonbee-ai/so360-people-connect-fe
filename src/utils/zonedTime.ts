// Wall-clock <-> UTC conversion in an IANA timezone, so event times are
// entered and shown in the org timezone (Core business_settings) instead of
// the browser's. Wall values use the DateTimePicker format 'YYYY-MM-DDTHH:mm'.

const pad = (n: number) => String(n).padStart(2, '0');

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute'), s: get('second') };
}

/** Offset of `timeZone` from UTC at `date`, in ms (positive east of UTC). */
function offsetMs(date: Date, timeZone: string): number {
  const p = zoneParts(date, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** 'YYYY-MM-DDTHH:mm' in `timeZone` -> ISO UTC string. Returns '' when unparseable. */
export function wallTimeToIso(wall: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall || '');
  if (!m) return '';
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const first = offsetMs(new Date(guess), timeZone);
  let utc = guess - first;
  // Re-check once across a DST boundary.
  const second = offsetMs(new Date(utc), timeZone);
  if (second !== first) utc = guess - second;
  return new Date(utc).toISOString();
}

/** ISO string -> 'YYYY-MM-DDTHH:mm' wall time in `timeZone`. Returns '' when unparseable. */
export function isoToWallTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const p = zoneParts(date, timeZone);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}
