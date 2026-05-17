import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

vi.mock('@so360/shell-context', () => ({
  ShellContext: React.createContext(null),
}));

import { useShellContext, usePeopleContext } from './useShellContext';
import { ShellContext } from '@so360/shell-context';

const mockContextValue = {
  user: { id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith' },
  tenants: [{ id: 't1', name: 'Acme' }],
  currentTenant: { id: 't1', name: 'Acme' },
  orgs: [{ id: 'o1', name: 'Org A', tenant_id: 't1' }],
  currentOrg: { id: 'o1', name: 'Org A', tenant_id: 't1' },
  isLoading: false,
  error: null,
  accessToken: 'token-abc',
  refreshContext: vi.fn(),
};

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(ShellContext.Provider, { value: mockContextValue as any }, children);

const nullWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(ShellContext.Provider, { value: null as any }, children);

describe('Given useShellContext inside a provider', () => {
  it('When called / Then it returns user data', () => {
    const { result } = renderHook(() => useShellContext(), { wrapper });
    expect(result.current.user?.id).toBe('u1');
    expect(result.current.user?.email).toBe('alice@test.com');
  });

  it('When called / Then it returns currentTenant', () => {
    const { result } = renderHook(() => useShellContext(), { wrapper });
    expect(result.current.currentTenant?.id).toBe('t1');
  });

  it('When called / Then it returns currentOrg', () => {
    const { result } = renderHook(() => useShellContext(), { wrapper });
    expect(result.current.currentOrg?.id).toBe('o1');
  });

  it('When called / Then it returns the accessToken', () => {
    const { result } = renderHook(() => useShellContext(), { wrapper });
    expect(result.current.accessToken).toBe('token-abc');
  });

  it('When called / Then isLoading is false', () => {
    const { result } = renderHook(() => useShellContext(), { wrapper });
    expect(result.current.isLoading).toBe(false);
  });
});

describe('Given useShellContext outside a provider', () => {
  it('When called without ShellContext.Provider / Then it throws an error', () => {
    expect(() =>
      renderHook(() => useShellContext(), { wrapper: nullWrapper })
    ).toThrow('useShellContext must be used within a ShellContext.Provider');
  });
});

describe('Given usePeopleContext inside a provider', () => {
  it('When called / Then tenantId and orgId are derived from shell context', () => {
    const { result } = renderHook(() => usePeopleContext(), { wrapper });
    expect(result.current.tenantId).toBe('t1');
    expect(result.current.orgId).toBe('o1');
  });

  it('When called / Then userName is derived from full_name', () => {
    const { result } = renderHook(() => usePeopleContext(), { wrapper });
    expect(result.current.userName).toBe('Alice Smith');
  });

  it('When tenant and org are set / Then isReady is true', () => {
    const { result } = renderHook(() => usePeopleContext(), { wrapper });
    expect(result.current.isReady).toBe(true);
  });

  it('When called / Then userId matches user id', () => {
    const { result } = renderHook(() => usePeopleContext(), { wrapper });
    expect(result.current.userId).toBe('u1');
  });
});
