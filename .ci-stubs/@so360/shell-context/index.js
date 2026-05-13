export const useShellBridge = () => null;
export const useShell = () => ({
  user: null, tenants: [], currentTenant: null, orgs: [],
  currentOrg: null, isLoading: false, error: null,
  accessToken: null, refreshContext: () => {},
});
export const ShellContext = null;
export const ShellContextType = null;
export const useModules = () => ({ modules: [], isModuleEnabled: () => true });
export const useFeatureFlags = () => ({ isFeatureEnabled: () => true });
export const eventBus = { publish: () => {}, subscribe: () => () => {} };
export default {};
