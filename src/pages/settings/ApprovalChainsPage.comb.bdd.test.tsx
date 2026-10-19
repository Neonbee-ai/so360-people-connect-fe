import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/orgPolicyService', () => ({
  orgPolicyApi: { getApprovalChains: vi.fn(), createApprovalChain: vi.fn(), deleteApprovalChain: vi.fn() },
}));
vi.mock('../../services/peopleService', () => ({ peopleApi: { getAll: vi.fn() } }));

const { flags } = vi.hoisted(() => ({ flags: { manage: true } }));
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: (k: string) => (k === 'action:people:approval_chains:manage' ? flags.manage : true),
    currentTenant: { id: 'tenant-1' },
    currentOrg: { id: 'org-1' },
  }),
}));
vi.mock('@so360/design-system', async () => await import('../../test/__mocks__/design-system'));

import { orgPolicyApi } from '../../services/orgPolicyService';
import ApprovalChainsPage from './ApprovalChainsPage';

const api = orgPolicyApi as any;
const chain = { id: 'c1', person_id: 'p1', person_name: 'Alice Doe', approver_person_id: 'p2', approver_name: 'Bob Boss', module_scope: 'all' };
const renderPage = () => render(<MemoryRouter><ApprovalChainsPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  flags.manage = true;
});

describe('Given ApprovalChainsPage built on Comb ListPageTemplate', () => {
  it('When chains load / Then the title, rows and New Relationship action are shown', async () => {
    api.getApprovalChains.mockResolvedValue([chain]);
    renderPage();
    expect(await screen.findByText('Alice Doe')).toBeInTheDocument();
    expect(screen.getByText('Approval Chains')).toBeInTheDocument();
    expect(screen.getByText('Bob Boss')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Relationship/ })).toBeInTheDocument();
  });

  it('When there are no chains / Then the empty state is shown', async () => {
    api.getApprovalChains.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No approval chains defined.')).toBeInTheDocument();
  });

  it('When searching for a non-matching name / Then the filtered empty state is shown', async () => {
    api.getApprovalChains.mockResolvedValue([chain]);
    renderPage();
    await screen.findByText('Alice Doe');
    fireEvent.change(screen.getByPlaceholderText('Search employee or approver...'), { target: { value: 'zzz' } });
    expect(await screen.findByText('No matching relationships found.')).toBeInTheDocument();
  });

  it('When Remove is confirmed / Then deleteApprovalChain is called with the person id', async () => {
    api.getApprovalChains.mockResolvedValue([chain]);
    api.deleteApprovalChain.mockResolvedValue({ success: true });
    renderPage();
    await screen.findByText('Alice Doe');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Remove')!);
    await waitFor(() => expect(api.deleteApprovalChain).toHaveBeenCalledWith('p1'));
  });

  it('When the manage flag is off / Then New Relationship and Remove are hidden', async () => {
    flags.manage = false;
    api.getApprovalChains.mockResolvedValue([chain]);
    renderPage();
    await screen.findByText('Alice Doe');
    expect(screen.queryByRole('button', { name: /New Relationship/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('When loading fails / Then an error banner shows the message', async () => {
    api.getApprovalChains.mockRejectedValue(new Error('Chains down'));
    renderPage();
    expect(await screen.findByText('Chains down')).toBeInTheDocument();
  });

  it('When New Relationship is clicked / Then the Define Approval Relationship modal opens', async () => {
    api.getApprovalChains.mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /New Relationship/ }));
    expect(await screen.findByRole('dialog', { name: 'Define Approval Relationship' })).toBeInTheDocument();
  });
});
