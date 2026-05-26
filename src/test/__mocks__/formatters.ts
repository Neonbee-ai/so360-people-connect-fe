export const formatCurrency = (v: number) => `$${v}`;
export const getCurrencySymbol = () => '$';
export const formatCompactCurrency = (v: number) => `$${v}`;
export const formatDate = (d: string) => d;
export const formatDateTime = (d: string) => d;
export const formatRelativeTime = (d: string) => d;
export const formatNumber = (n: number) => String(n);
export const formatPercent = (n: number) => `${n}%`;
export const formatPercentage = (n: number) => `${n}%`;
export const useFormatters = () => ({
  formatCurrency,
  getCurrencySymbol,
  formatCompactCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatPercent,
  formatPercentage,
});
