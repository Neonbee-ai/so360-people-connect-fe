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
export declare const eventBus: any;
declare const _: any;
export default _;
