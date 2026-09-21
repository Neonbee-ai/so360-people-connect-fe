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
export const useNotify = () => ({ emitNotification: () => {} });
export const useActivity = () => ({ recordActivity: async () => {} });
export const useBusinessSettings = () => ({ settings: { currency: 'USD' }, isLoading: false, error: null });
export const eventBus = { publish: () => {}, subscribe: () => () => {} };
export default {};
export const useSandboxLimit = () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items) => items, isLimited: () => false });
export const useQuota = () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: () => {} });
// Quota interceptor surface — see index.d.ts for why these live here.
export const QUOTA_EXCEEDED_EVENT = '__so360_quota_exceeded';
export const buildQuotaExceededDetail = (body) => (body && body.resolution) || body;
export const installQuotaExceededInterceptor = () => () => {};
