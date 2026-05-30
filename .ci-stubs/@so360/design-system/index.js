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
