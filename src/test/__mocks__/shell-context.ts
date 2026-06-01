import React, { useContext } from 'react';

// Default context value used when no Provider wraps the component under test
const defaultShellValue: any = {
  user: { id: 'mock-user-id', email: 'test@test.com', full_name: 'Test User' },
  currentOrg: { id: 'org-1', name: 'Test Org' },
  currentTenant: { id: 'tenant-1', name: 'Test Tenant' },
  tenants: [],
  orgs: [],
  accessToken: 'mock-token',
  isLoading: false,
  error: null,
  refreshContext: async () => {},
  isModuleEnabled: () => false,
  isFeatureHidden: () => false,
  isFeatureEnabled: () => true,
  businessSettings: { base_currency: 'USD', document_language: 'en-US' },
  enabledModules: [],
  toggleModule: async () => {},
  refreshModules: async () => {},
  modulesLoading: false,
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  emitNotification: async () => ({ success: true, notificationIds: [], errors: [] }),
  recordActivity: async () => {},
  businessSettingsLoading: false,
  refreshBusinessSettings: async () => {},
  setUser: () => {},
  setCurrentTenant: () => {},
  setCurrentOrg: () => {},
};

export const ShellContext = React.createContext<any>(defaultShellValue);

// useShell reads from the context so that ShellContext.Provider wrappers in tests work
export const useShell = () => {
  const ctx = useContext(ShellContext);
  return ctx ?? defaultShellValue;
};
export const useBusinessSettings = () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } });
export const useNotify = () => ({ emitNotification: async () => {} });
export const useActivity = () => ({ recordActivity: async () => {} });
export const useShellBridge = () => ({
  effectiveFlagsLoaded: true,
  isFeatureEnabled: () => true,
  isFeatureHidden: () => false,
  currentOrg: { id: 'org-1', name: 'Test Org' },
  currentTenant: { id: 'tenant-1', name: 'Test Tenant' },
});
export const usePeople = () => ({ people: [] });
export const useEntitlements = () => ({ can: () => true });
export const Can = ({ children }: any) => children;

export const useQuota = () => ({
  quotas: [],
  isLoading: false,
  error: null,
  isExceeded: () => false,
  getQuota: () => null,
  getPercentage: () => 0,
  refresh: async () => {},
});
