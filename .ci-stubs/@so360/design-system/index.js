export const useShellBridge = () => null;
export const useShell = () => ({});
export const eventBus = { publish: () => {}, subscribe: () => () => {} };
export default {};
export const QuotaGate = ({ children }) => children;
export const QuotaBar = () => null;
export const FeatureRoute = ({ state, children, hiddenFallback, lockedFallback, disabledFallback }) => {
  if (state === 'locked') return lockedFallback ?? null;
  if (state === 'disabled') return disabledFallback ?? null;
  if (state === 'hidden') return hiddenFallback ?? null;
  return children;
};

export const toast = {
  success: () => "toast-id",
  error: () => "toast-id",
  warning: () => "toast-id",
  info: () => "toast-id",
  promise: (p) => p,
  dismiss: () => {},
};
export const useToast = () => toast;
export const getErrorMessage = (_e, fallback) => fallback ?? "error";
export const attachToastErrorHandler = () => 0;
export const toastBus = { subscribe: () => () => {}, show: () => "toast-id", dismiss: () => {}, getToasts: () => [] };
export const ToastViewport = () => null;
export const ToastProvider = ({ children }) => children ?? null;
