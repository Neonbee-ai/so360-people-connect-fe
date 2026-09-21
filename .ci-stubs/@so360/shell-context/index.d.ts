import { Context } from 'react';

export interface ShellContextType {
  user: any;
  tenants: any[];
  currentTenant: any;
  orgs: any[];
  currentOrg: any;
  isLoading: boolean;
  error: any;
  accessToken: string | null;
  refreshContext: () => void;
  [key: string]: any;
}

export declare const ShellContext: Context<ShellContextType>;
export declare const useShellBridge: () => any;
export declare const useShell: () => ShellContextType;
export declare const useModules: () => any;
export declare const useFeatureFlags: () => any;
export declare const useActivity: () => { recordActivity: (...args: any[]) => Promise<void> };
export declare const useBusinessSettings: () => any;
export declare const useNotify: () => { emitNotification: (...args: any[]) => void };
export declare const eventBus: any;
declare const _: any;
export default _;
export const useSandboxLimit: any;
export const useQuota: any;

// Quota interceptor surface. src/services/quotaExceeded.ts imports these, and
// the gate injects .ci-stubs OVER node_modules — so their absence here made the
// stub disagree with the real package (shell-context exports both from
// utils/quotaInterceptor). Nothing caught it until the typecheck tier ran,
// because transpiling does not resolve types.
export declare const QUOTA_EXCEEDED_EVENT: string;
export declare const buildQuotaExceededDetail: any;
export declare const installQuotaExceededInterceptor: any;
