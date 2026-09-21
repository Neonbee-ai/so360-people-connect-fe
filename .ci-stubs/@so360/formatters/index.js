export const formatCurrency = (amount) => `$${(amount ?? 0).toFixed(2)}`;
export const getCurrencySymbol = () => '$';
export const formatCompactCurrency = (amount) => `$${(amount ?? 0).toFixed(0)}`;
export const formatDate = (d) => d || '';
export const formatDateTime = (d) => d || '';
export const formatRelativeTime = (d) => d || '';
export const formatNumber = (n) => String(n ?? 0);
export const formatPercentage = (n) => `${(n ?? 0).toFixed(1)}%`;
export const useFormatters = () => ({
  formatCurrency: (amount) => `$${(amount ?? 0).toFixed(2)}`,
  getCurrencySymbol: () => '$',
  formatCompactCurrency: (amount) => `$${(amount ?? 0).toFixed(0)}`,
  formatDate: (d) => d || '',
  formatDateTime: (d) => d || '',
  formatRelativeTime: (d) => d || '',
  formatNumber: (n) => String(n ?? 0),
  formatPercentage: (n) => `${(n ?? 0).toFixed(1)}%`,
});
export default {};
