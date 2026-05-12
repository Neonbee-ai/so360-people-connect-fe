import React from 'react';
export const useShell = () => ({
  isModuleEnabled: () => false,
  isFeatureHidden: () => false,
  isFeatureEnabled: () => true,
  businessSettings: { base_currency: 'USD', document_language: 'en-US' },
});
export const useBusinessSettings = () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } });
export const useNotify = () => ({ emitNotification: async () => {} });
export const useActivity = () => ({ recordActivity: async () => {} });
export const useShellBridge = () => ({
  isFeatureEnabled: () => true,
  isFeatureHidden: () => false,
  currentOrg: { id: 'org-1', name: 'Test Org' },
  currentTenant: { id: 'tenant-1', name: 'Test Tenant' },
});
export const usePeople = () => ({ people: [] });
export const useEntitlements = () => ({ can: () => true });
export const Can = ({ children }: any) => children;
export const ShellContext = React.createContext<any>({
  user: { id: 'mock-user-id', email: 'test@test.com', full_name: 'Test User' },
  currentOrg: { id: 'org-1', name: 'Test Org' },
  currentTenant: { id: 'tenant-1', name: 'Test Tenant' },
  accessToken: 'mock-token',
});
