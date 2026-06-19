import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/orgPolicyService', () => ({
  orgPolicyApi: {
    getApprovalChains: vi.fn(),
    deleteApprovalChain: vi.fn(),
    createApprovalChain: vi.fn(),
  },
}));

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    currentTenant: { id: '3cf1c619-c8f6-49ac-9207-447418d5beee' },
    currentOrg: { id: '8317fe18-6ac4-4ac4-b71d-dc13122a905d' },
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, onClick, disabled, type }: any) => (
    <button onClick={onClick} disabled={disabled} type={type}>{children}</button>
  ),
}));

import { orgPolicyApi } from '../services/orgPolicyService';
import ApprovalChainsPage from '../pages/settings/ApprovalChainsPage';

const mockOrgPolicyApi = orgPolicyApi as any;

const renderPage = () => render(<MemoryRouter><ApprovalChainsPage /></MemoryRouter>);

describe('Given ApprovalChainsPage — Org approval chain management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Given approval chains are loaded', () => {
    it('When chains exist / Then renders chain rows', async () => {
      mockOrgPolicyApi.getApprovalChains.mockResolvedValueOnce([
        {
          id: 'c1',
          person_id: 'p1',
          person_name: 'Alice Smith',
          approver_person_id: 'p2',
          approver_name: 'Bob Manager',
          module_scope: 'all',
        },
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      expect(screen.getByText('Bob Manager')).toBeInTheDocument();
    });

    it('When no chains / Then shows empty state', async () => {
      mockOrgPolicyApi.getApprovalChains.mockResolvedValueOnce([]);
      renderPage();
      await waitFor(() => expect(screen.getByText('No approval chains defined.')).toBeInTheDocument());
    });
  });

  describe('Given load fails', () => {
    it('When API errors / Then shows error message', async () => {
      mockOrgPolicyApi.getApprovalChains.mockRejectedValueOnce(new Error('Service unavailable'));
      renderPage();
      await waitFor(() => expect(screen.getByText('Service unavailable')).toBeInTheDocument());
    });
  });

  describe('Given page heading', () => {
    it('When page renders / Then shows Approval Chains heading', async () => {
      mockOrgPolicyApi.getApprovalChains.mockResolvedValueOnce([]);
      renderPage();
      await waitFor(() => expect(screen.getByText('Approval Chains')).toBeInTheDocument());
    });
  });
});
