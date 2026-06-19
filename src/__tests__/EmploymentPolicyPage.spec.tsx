import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/orgPolicyService', () => ({
  orgPolicyApi: {
    getEmploymentPolicy: vi.fn(),
    updateEmploymentPolicy: vi.fn(),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    currentTenant: { id: '3cf1c619-c8f6-49ac-9207-447418d5beee' },
    currentOrg: { id: '8317fe18-6ac4-4ac4-b71d-dc13122a905d' },
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  }),
}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, onClick, disabled, type }: any) => (
    <button onClick={onClick} disabled={disabled} type={type}>{children}</button>
  ),
  FeatureGate: ({ children }: any) => <>{children}</>,
}));

import { orgPolicyApi } from '../services/orgPolicyService';
import EmploymentPolicyPage from '../pages/settings/EmploymentPolicyPage';

const mockOrgPolicyApi = orgPolicyApi as any;

const renderPage = () => render(<MemoryRouter><EmploymentPolicyPage /></MemoryRouter>);

describe('Given EmploymentPolicyPage — Org employment policy management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Given policy is loaded', () => {
    it('When policy exists / Then shows thresholds', async () => {
      mockOrgPolicyApi.getEmploymentPolicy.mockResolvedValueOnce({
        daily_threshold: 8,
        weekly_threshold: 40,
        premium_multiplier: 1.5,
      });
      renderPage();
      await waitFor(() => expect(screen.getByDisplayValue('8')).toBeInTheDocument());
      expect(screen.getByDisplayValue('40')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
    });
  });

  describe('Given load fails', () => {
    it('When API errors / Then shows error state', async () => {
      mockOrgPolicyApi.getEmploymentPolicy.mockRejectedValueOnce(new Error('Service error'));
      renderPage();
      await waitFor(() => expect(screen.getByText('Unable to load employment policy')).toBeInTheDocument());
    });
  });

  describe('Given page heading', () => {
    it('When page renders / Then shows Employment Policy heading', async () => {
      mockOrgPolicyApi.getEmploymentPolicy.mockResolvedValueOnce({
        daily_threshold: 8,
        weekly_threshold: 40,
        premium_multiplier: 1.5,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('Employment Policy')).toBeInTheDocument());
    });
  });
});
