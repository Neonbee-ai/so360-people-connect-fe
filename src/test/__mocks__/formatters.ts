export const getCurrencySymbol = () => '$';
export const formatCompactCurrency = (v: number) => `$${v}`;

export const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v) || 0);

export const formatDate = (
  d: Date | string | number | null | undefined,
  timezone: string = 'UTC',
  locale: string = 'en-US',
): string => {
  if (!d) return '-';
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: timezone }).format(dateObj);
};

export const formatDateTime = (
  d: Date | string | number | null | undefined,
  timezone: string = 'UTC',
  locale: string = 'en-US',
): string => {
  if (!d) return '-';
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(dateObj);
};

export const formatRelativeTime = (d: Date | string | number | null | undefined) => (d ? String(d) : '-');
export const formatNumber = (n: number) => String(n);
export const formatPercent = (n: number) => `${n}%`;
export const formatPercentage = (n: number) => `${n}%`;

// ── Date-only (business date) primitives ────────────────────────────────────
// vitest.config.ts aliases '@so360/formatters' to THIS file, so it is what every
// spec resolves. Real implementations, not passthroughs: attendance and
// timesheet work turns on WHICH calendar day a record belongs to, and a
// passthrough would agree with whatever the caller did and hide the bug.
export const toBusinessDate = (
  d: Date | string | number | null | undefined,
  timezone: string = 'UTC',
): string => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(dt);
  } catch {
    return dt.toISOString().slice(0, 10);
  }
};
export const businessToday = (timezone: string = 'UTC'): string => toBusinessDate(new Date(), timezone);
const zoneOffsetMs = (at: Date, timezone: string): number => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(at);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - at.getTime();
  } catch { return 0; }
};
export const startOfBusinessDayUtc = (businessDate: string, timezone: string = 'UTC'): Date => {
  const naive = new Date(`${businessDate}T00:00:00Z`);
  if (isNaN(naive.getTime())) return naive;
  const off = zoneOffsetMs(naive, timezone);
  const corrected = new Date(naive.getTime() - off);
  const settled = zoneOffsetMs(corrected, timezone);
  return settled === off ? corrected : new Date(naive.getTime() - settled);
};
export const endOfBusinessDayUtcExclusive = (businessDate: string, timezone: string = 'UTC'): Date => {
  const start = startOfBusinessDayUtc(businessDate, timezone);
  if (isNaN(start.getTime())) return start;
  return startOfBusinessDayUtc(toBusinessDate(new Date(start.getTime() + 36 * 3600 * 1000), timezone), timezone);
};

export const useFormatters = (config: { currency?: string; locale?: string; timezone?: string } = {}) => {
  const currency = config.currency || 'USD';
  const locale = config.locale || 'en-US';
  const timezone = config.timezone || 'UTC';
  return {
    toBusinessDate: (d: any) => toBusinessDate(d, timezone),
    businessToday: () => businessToday(timezone),
    startOfBusinessDayUtc: (d: string) => startOfBusinessDayUtc(d, timezone),
    endOfBusinessDayUtcExclusive: (d: string) => endOfBusinessDayUtcExclusive(d, timezone),
    formatCurrency: (v: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(v) || 0),
    getCurrencySymbol: () => '$',
    formatCompactCurrency: (v: number) => `$${v}`,
    formatDate: (d: Date | string | number | null | undefined) => formatDate(d, timezone, locale),
    formatDateTime: (d: Date | string | number | null | undefined) => formatDateTime(d, timezone, locale),
    formatRelativeTime: (d: Date | string | number | null | undefined) => (d ? String(d) : '-'),
    formatNumber: (n: number) => String(n),
    formatPercent: (n: number) => `${n}%`,
    formatPercentage: (n: number) => `${n}%`,
    currency,
    locale,
    timezone,
  };
};
