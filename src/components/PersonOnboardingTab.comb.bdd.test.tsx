import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const toastError = vi.fn();
vi.mock('@so360/design-system', async (orig) => {
  const actual = await orig<any>();
  return { ...actual, toast: { ...actual.toast, error: (...a: any[]) => toastError(...a) } };
});

vi.mock('../services/onboardingService', async () => {
  const actual = await vi.importActual<any>('../services/onboardingService');
  return {
    ...actual,
    onboardingApi: {
      listInstances: vi.fn(), listTemplates: vi.fn(), getInstance: vi.fn(), startOnboarding: vi.fn(),
      cancelInstance: vi.fn(), completeItem: vi.fn(), waiveItem: vi.fn(), uploadItemDocument: vi.fn(),
    },
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

let mockShell: any;
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => mockShell }));

import PersonOnboardingTab from './PersonOnboardingTab';
import { onboardingApi } from '../services/onboardingService';
const api = onboardingApi as any;

const instance = {
  id: 'inst-1', person_id: 'p1', template_id: 't1', status: 'in_progress', started_at: '2026-08-20T09:00:00Z', completed_at: null,
  items: [
    { id: 'i1', title: 'Sign contract', item_type: 'e_sign', assignee_role: 'employee', sort_order: 0, is_required: true, status: 'done', due_date: null },
    { id: 'i2', title: 'IT induction', item_type: 'meeting', assignee_role: 'hr', sort_order: 1, is_required: true, status: 'pending', due_date: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockShell = { permissionsLoaded: true, hasPermission: () => true };
  api.listTemplates.mockResolvedValue({ data: [{ id: 'tpl', name: 'Std', is_active: true, is_default: true }], total: 1 });
});

describe('Given PersonOnboardingTab in Comb', () => {
  it('When no instance exists and the viewer can manage / Then Start onboarding posts the person id', async () => {
    api.listInstances.mockResolvedValue({ data: [] });
    api.startOnboarding.mockResolvedValue({});
    render(<PersonOnboardingTab personId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start onboarding' }));
    await waitFor(() => expect(api.startOnboarding).toHaveBeenCalledWith({ person_id: 'p1', template_id: 'tpl' }));
  });

  it('When the viewer lacks onboarding.manage / Then Start onboarding is hidden', async () => {
    mockShell = { permissionsLoaded: true, hasPermission: () => false };
    api.listInstances.mockResolvedValue({ data: [] });
    render(<PersonOnboardingTab personId="p1" />);
    expect(await screen.findByText('No onboarding')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start onboarding' })).not.toBeInTheDocument();
  });

  it('When an instance loads / Then progress and the checklist render', async () => {
    api.listInstances.mockResolvedValue({ data: [{ id: 'inst-1', status: 'in_progress', started_at: '2026-08-20' }] });
    api.getInstance.mockResolvedValue(instance);
    render(<PersonOnboardingTab personId="p1" />);
    expect(await screen.findByText('1 of 2 steps settled')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('IT induction')).toBeInTheDocument();
  });

  it('When Complete is clicked / Then the item is completed via the API', async () => {
    api.listInstances.mockResolvedValue({ data: [{ id: 'inst-1', status: 'in_progress', started_at: '2026-08-20' }] });
    api.getInstance.mockResolvedValue(instance);
    api.completeItem.mockResolvedValue({ instance_completed: false });
    render(<PersonOnboardingTab personId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Complete/ }));
    await waitFor(() => expect(api.completeItem).toHaveBeenCalledWith('i2'));
  });

  it('When Waive is confirmed without a reason / Then the submit stays disabled, and with one it sends the note', async () => {
    api.listInstances.mockResolvedValue({ data: [{ id: 'inst-1', status: 'in_progress', started_at: '2026-08-20' }] });
    api.getInstance.mockResolvedValue(instance);
    api.waiveItem.mockResolvedValue({ instance_completed: false });
    render(<PersonOnboardingTab personId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Waive/ }));
    const submit = await screen.findByRole('button', { name: 'Waive Item' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Why this step doesn't apply"), { target: { value: 'n/a' } });
    fireEvent.click(submit);
    await waitFor(() => expect(api.waiveItem).toHaveBeenCalledWith('i2', 'n/a'));
  });

  it('When loading fails / Then an error toast is raised', async () => {
    api.listInstances.mockRejectedValue(new Error('down'));
    render(<PersonOnboardingTab personId="p1" />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
