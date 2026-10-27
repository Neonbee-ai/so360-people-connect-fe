import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/orgPolicyService', () => ({
  orgPolicyApi: { getEmploymentPolicy: vi.fn(), updateEmploymentPolicy: vi.fn() },
}));

const { flags } = vi.hoisted(() => ({ flags: { manage: true } }));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: (k: string) => (k === 'action:people:employment_policy:manage' ? flags.manage : true),
    currentTenant: { id: 'tenant-1' },
    currentOrg: { id: 'org-1' },
  }),
}));

vi.mock('@so360/design-system', async () => await import('../../test/__mocks__/design-system'));

import { orgPolicyApi } from '../../services/orgPolicyService';
import EmploymentPolicyPage from './EmploymentPolicyPage';

const api = orgPolicyApi as any;
const policy = { id: 'p1', daily_threshold: 8, weekly_threshold: 40, premium_multiplier: 1.5 };
const renderPage = () => render(<MemoryRouter><EmploymentPolicyPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  flags.manage = true;
});

describe('Given EmploymentPolicyPage built on Comb SettingsPageTemplate', () => {
  it('When the policy is loading / Then a spinner is shown', () => {
    api.getEmploymentPolicy.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: 'Loading employment policy...' })).toBeInTheDocument();
  });

  it('When the policy loads / Then the title, cards and Save Policy action are shown', async () => {
    api.getEmploymentPolicy.mockResolvedValue(policy);
    renderPage();
    expect(await screen.findByText('Employment Policy')).toBeInTheDocument();
    expect(await screen.findByText('Daily Threshold')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Policy/ })).toBeInTheDocument();
  });

  it('When Save Policy is clicked / Then updateEmploymentPolicy receives the loaded policy', async () => {
    api.getEmploymentPolicy.mockResolvedValue(policy);
    api.updateEmploymentPolicy.mockResolvedValue(policy);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Save Policy/ }));
    await waitFor(() => expect(api.updateEmploymentPolicy).toHaveBeenCalledWith(policy));
  });

  it('When the manage flag is off / Then Save Policy is hidden', async () => {
    flags.manage = false;
    api.getEmploymentPolicy.mockResolvedValue(policy);
    renderPage();
    await screen.findByText('Daily Threshold');
    expect(screen.queryByRole('button', { name: /Save Policy/ })).not.toBeInTheDocument();
  });

  it('When loading fails / Then a warning banner shows the error', async () => {
    api.getEmploymentPolicy.mockRejectedValue(new Error('nope'));
    renderPage();
    expect(await screen.findByText('Unable to load employment policy')).toBeInTheDocument();
  });

  it('When saving fails / Then the save error message is shown', async () => {
    api.getEmploymentPolicy.mockResolvedValue(policy);
    api.updateEmploymentPolicy.mockRejectedValue(new Error('Save blew up'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Save Policy/ }));
    expect(await screen.findByText(/Save blew up/)).toBeInTheDocument();
  });
});
