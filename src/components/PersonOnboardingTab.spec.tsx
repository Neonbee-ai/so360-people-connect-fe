import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * PersonOnboardingTab — BDD specs (focused component spec; PersonDetailPage
 * only mounts this for activeTab === 'onboarding').
 *
 * Pinned behaviours: no instance + manage → Start onboarding creates one;
 * an instance renders progress and per-item actions; waive never fires
 * without the note the backend requires.
 */

vi.mock('../services/onboardingService', async () => {
  const actual = await vi.importActual<any>('../services/onboardingService');
  return {
    ...actual,
    onboardingApi: {
      listInstances: vi.fn(),
      getInstance: vi.fn(),
      startOnboarding: vi.fn(),
      cancelInstance: vi.fn(),
      completeItem: vi.fn(),
      waiveItem: vi.fn(),
      uploadItemDocument: vi.fn(),
    },
  };
});

let mockShell: any;

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => mockShell,
}));

import PersonOnboardingTab from './PersonOnboardingTab';
import { onboardingApi } from '../services/onboardingService';

const mockApi = onboardingApi as any;

const instanceFixture = {
  id: 'inst-1',
  person_id: 'p1',
  template_id: 't1',
  status: 'in_progress',
  started_at: '2026-08-20T09:00:00.000Z',
  completed_at: null,
  items: [
    { id: 'item-1', instance_id: 'inst-1', template_item_id: 'ti1', title: 'Sign contract', description: null, item_type: 'e_sign', assignee_role: 'employee', sort_order: 0, is_required: true, status: 'done', due_date: null },
    { id: 'item-2', instance_id: 'inst-1', template_item_id: 'ti2', title: 'IT induction', description: null, item_type: 'meeting', assignee_role: 'hr', sort_order: 1, is_required: true, status: 'pending', due_date: '2026-08-27' },
  ],
};

const renderTab = () => render(<PersonOnboardingTab personId="p1" />);

beforeEach(() => {
  vi.clearAllMocks();
  mockShell = { permissionsLoaded: true, hasPermission: () => true };
});

describe('Given a person with no onboarding instance', () => {
  beforeEach(() => {
    mockApi.listInstances.mockResolvedValue({ data: [], total: 0 });
  });

  it('When the tab loads / Then a Start onboarding affordance is offered to manage holders', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText('No onboarding')).toBeInTheDocument());
    expect(screen.getByText('Start onboarding')).toBeInTheDocument();
    expect(mockApi.listInstances).toHaveBeenCalledWith({ person_id: 'p1' });
  });

  it('When Start onboarding is clicked / Then an instance is created for the person', async () => {
    mockApi.startOnboarding.mockResolvedValue({ ...instanceFixture });
    renderTab();
    await waitFor(() => expect(screen.getByText('Start onboarding')).toBeInTheDocument());

    // After the create succeeds the reload should now find the instance.
    mockApi.listInstances.mockResolvedValue({ data: [{ ...instanceFixture, items: undefined }], total: 1 });
    mockApi.getInstance.mockResolvedValue(instanceFixture);

    fireEvent.click(screen.getByText('Start onboarding'));
    await waitFor(() => expect(mockApi.startOnboarding).toHaveBeenCalledWith({ person_id: 'p1' }));
    await waitFor(() => expect(screen.getByText('Onboarding in progress')).toBeInTheDocument());
  });

  it('When the viewer lacks onboarding.manage / Then no Start button is offered', async () => {
    mockShell = { permissionsLoaded: true, hasPermission: (code: string) => code !== 'onboarding.manage' };
    renderTab();
    await waitFor(() => expect(screen.getByText('No onboarding')).toBeInTheDocument());
    expect(screen.queryByText('Start onboarding')).not.toBeInTheDocument();
  });
});

describe('Given a person with an in-progress instance', () => {
  beforeEach(() => {
    mockApi.listInstances.mockResolvedValue({ data: [{ ...instanceFixture, items: undefined }], total: 1 });
    mockApi.getInstance.mockResolvedValue(instanceFixture);
  });

  it('When the tab loads / Then progress and the ordered checklist render', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText('Onboarding in progress')).toBeInTheDocument());
    expect(screen.getByText('1 of 2 steps settled')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-progress')).toHaveStyle({ width: '50%' });
    expect(screen.getByText('Sign contract')).toBeInTheDocument();
    expect(screen.getByText('IT induction')).toBeInTheDocument();
    expect(mockApi.getInstance).toHaveBeenCalledWith('inst-1');
  });

  it('When Complete is clicked on a pending item / Then the admin complete route is called', async () => {
    mockApi.completeItem.mockResolvedValue({ id: 'item-2', status: 'done', instance_completed: true });
    renderTab();
    await waitFor(() => expect(screen.getByText('IT induction')).toBeInTheDocument());
    // Only the pending item carries actions.
    fireEvent.click(screen.getByText('Complete'));
    await waitFor(() => expect(mockApi.completeItem).toHaveBeenCalledWith('item-2'));
  });

  it('When Waive is clicked / Then nothing is sent until a note is provided', async () => {
    mockApi.waiveItem.mockResolvedValue({ id: 'item-2', status: 'waived', instance_completed: false });
    renderTab();
    await waitFor(() => expect(screen.getByText('IT induction')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Waive'));

    await waitFor(() => expect(screen.getByText('Waive Onboarding Item')).toBeInTheDocument());
    const submit = screen.getByText('Waive Item');
    // The backend rejects a note-less waive — the UI must not even try.
    expect(submit).toBeDisabled();
    expect(mockApi.waiveItem).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Why this step doesn't apply"), {
      target: { value: 'Signed on paper before joining' },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mockApi.waiveItem).toHaveBeenCalledWith('item-2', 'Signed on paper before joining'),
    );
  });

  it('When the viewer can manage / Then Cancel onboarding is available on in-progress instances', async () => {
    mockApi.cancelInstance.mockResolvedValue({ ...instanceFixture, status: 'cancelled' });
    renderTab();
    await waitFor(() => expect(screen.getByText('Cancel onboarding')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel onboarding'));
    await waitFor(() => expect(mockApi.cancelInstance).toHaveBeenCalledWith('inst-1'));
  });
});

// B4 — HR files the collected document on the hire's behalf.
describe('Given an in-progress instance with a pending document_upload item', () => {
  const docInstance = {
    ...instanceFixture,
    items: [
      { id: 'item-doc', instance_id: 'inst-1', template_item_id: 'ti3', title: 'Collect passport copy', description: null, item_type: 'document_upload', assignee_role: 'employee', sort_order: 0, is_required: true, status: 'pending', due_date: '2026-08-27' },
      { id: 'item-task', instance_id: 'inst-1', template_item_id: 'ti4', title: 'IT induction', description: null, item_type: 'meeting', assignee_role: 'hr', sort_order: 1, is_required: true, status: 'pending', due_date: null },
    ],
  };

  beforeEach(() => {
    mockApi.listInstances.mockResolvedValue({ data: [{ ...docInstance, items: undefined }], total: 1 });
    mockApi.getInstance.mockResolvedValue(docInstance);
  });

  it('When the checklist renders / Then only the document item offers Attach document', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText('Collect passport copy')).toBeInTheDocument());
    expect(screen.getAllByText('Attach document')).toHaveLength(1);
  });

  it('When Attach document is submitted / Then the upload route is called with the file reference and the checklist refreshes', async () => {
    mockApi.uploadItemDocument.mockResolvedValue({ id: 'item-doc', status: 'done', instance_completed: false });
    renderTab();
    await waitFor(() => expect(screen.getByText('Attach document')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Attach document'));

    await waitFor(() => expect(screen.getByText('Attach Document')).toBeInTheDocument());
    const submit = screen.getByText('Attach & Mark Done');
    // No file name yet — the UI must not even try.
    expect(submit).toBeDisabled();
    expect(mockApi.uploadItemDocument).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('e.g. passport.pdf'), {
      target: { value: 'passport.pdf' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'https://cdn.example/passport.pdf' },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mockApi.uploadItemDocument).toHaveBeenCalledWith('item-doc', {
        file_name: 'passport.pdf',
        file_url: 'https://cdn.example/passport.pdf',
      }),
    );
  });

  it('When the viewer lacks onboarding.manage / Then no Attach affordance is offered', async () => {
    mockShell = { permissionsLoaded: true, hasPermission: (code: string) => code !== 'onboarding.manage' };
    renderTab();
    await waitFor(() => expect(screen.getByText('Collect passport copy')).toBeInTheDocument());
    expect(screen.queryByText('Attach document')).not.toBeInTheDocument();
  });
});

describe('Given only a cancelled instance exists', () => {
  it('When the tab loads / Then it is treated as no onboarding', async () => {
    mockApi.listInstances.mockResolvedValue({
      data: [{ ...instanceFixture, status: 'cancelled', items: undefined }],
      total: 1,
    });
    renderTab();
    await waitFor(() => expect(screen.getByText('No onboarding')).toBeInTheDocument());
    expect(mockApi.getInstance).not.toHaveBeenCalled();
  });
});
