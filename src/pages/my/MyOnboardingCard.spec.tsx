import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * MyOnboardingCard — BDD specs.
 *
 * The "Your onboarding" card on My Work. Pinned behaviours: absent when there
 * is no active instance (or the endpoint fails), shows progress when there is,
 * lets the employee complete their own task/meeting steps via the /me surface,
 * attaches documents to their document_upload steps (B4), and shows signature
 * steps as waiting (the Sign flow, B3, settles them).
 */

vi.mock('../../services/onboardingService', async () => {
  const actual = await vi.importActual<any>('../../services/onboardingService');
  return {
    ...actual,
    myOnboardingApi: {
      get: vi.fn(),
      completeItem: vi.fn(),
      uploadItemDocument: vi.fn(),
    },
  };
});

import MyOnboardingCard from './MyOnboardingCard';
import { myOnboardingApi } from '../../services/onboardingService';

const mockApi = myOnboardingApi as any;

const instance = {
  id: 'inst-1',
  person_id: 'p1',
  template_id: 't1',
  status: 'in_progress',
  started_at: '2026-08-20T09:00:00.000Z',
  completed_at: null,
};

const items = [
  { id: 'it-done', title: 'Read the handbook', item_type: 'task', assignee_role: 'employee', sort_order: 0, is_required: true, status: 'done', due_date: null },
  { id: 'it-task', title: 'Set up your workstation', item_type: 'task', assignee_role: 'employee', sort_order: 1, is_required: true, status: 'pending', due_date: '2026-08-25' },
  { id: 'it-sign', title: 'Sign your contract', item_type: 'e_sign', assignee_role: 'employee', sort_order: 2, is_required: true, status: 'pending', due_date: null },
  { id: 'it-doc', title: 'Upload your passport', item_type: 'document_upload', assignee_role: 'employee', sort_order: 3, is_required: true, status: 'pending', due_date: null },
  { id: 'it-hr', title: 'Payroll registration', item_type: 'task', assignee_role: 'hr', sort_order: 4, is_required: true, status: 'pending', due_date: null },
];

const renderCard = () =>
  render(
    <MemoryRouter>
      <MyOnboardingCard />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Given the employee has no active onboarding', () => {
  it('When the API returns nulls / Then the card renders nothing', async () => {
    mockApi.get.mockResolvedValue({ instance: null, items: [] });
    const { container } = renderCard();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('When the instance is already completed / Then the card renders nothing', async () => {
    mockApi.get.mockResolvedValue({ instance: { ...instance, status: 'completed' }, items });
    const { container } = renderCard();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('When the endpoint fails / Then the card hides instead of degrading the page', async () => {
    mockApi.get.mockRejectedValue(new Error('flag off'));
    const { container } = renderCard();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });
});

describe('Given an active onboarding instance', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({ instance, items });
  });

  it('When the card renders / Then it shows progress across all items', async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText('Your onboarding')).toBeInTheDocument());
    expect(screen.getByText('1 of 5 steps done')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('When steps are pending / Then employee task steps get Mark done and e_sign shows as waiting', async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText('Set up your workstation')).toBeInTheDocument());
    // Exactly one self-completable pending step in the fixture.
    expect(screen.getAllByText('Mark done')).toHaveLength(1);
    // e_sign completes via its own flow — no button, a waiting label.
    expect(screen.getByText('Awaiting signature')).toBeInTheDocument();
    // HR-assigned work is visible but not actionable by the employee.
    expect(screen.getByText('Payroll registration')).toBeInTheDocument();
  });

  it('When Mark done is clicked / Then the /me complete API is called and the card refreshes', async () => {
    mockApi.completeItem.mockResolvedValue({ id: 'it-task', status: 'done', instance_completed: false });
    renderCard();
    await waitFor(() => expect(screen.getByText('Mark done')).toBeInTheDocument());

    mockApi.get.mockResolvedValue({
      instance,
      items: items.map(i => (i.id === 'it-task' ? { ...i, status: 'done' } : i)),
    });

    fireEvent.click(screen.getByText('Mark done'));
    await waitFor(() => expect(mockApi.completeItem).toHaveBeenCalledWith('it-task'));
    await waitFor(() => expect(screen.getByText('2 of 5 steps done')).toBeInTheDocument());
  });

  // B4 — the document step completes by attaching the requested document.
  it('When a document step is pending / Then it gets an Attach affordance instead of Mark done', async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText('Upload your passport')).toBeInTheDocument());
    expect(screen.getByText('Attach')).toBeInTheDocument();
    // Still exactly one Mark done — the doc step never self-completes.
    expect(screen.getAllByText('Mark done')).toHaveLength(1);
  });

  it('When Attach is submitted / Then the /me upload route is called with the file reference and the card refreshes', async () => {
    mockApi.uploadItemDocument.mockResolvedValue({ id: 'it-doc', status: 'done', instance_completed: false });
    renderCard();
    await waitFor(() => expect(screen.getByText('Attach')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Attach'));

    const submit = await screen.findByText('Attach document');
    // No file name yet — the UI must not even try.
    expect(submit).toBeDisabled();
    expect(mockApi.uploadItemDocument).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('File name (e.g. passport.pdf)'), {
      target: { value: 'passport.pdf' },
    });
    fireEvent.change(screen.getByPlaceholderText('Link to the file (optional)'), {
      target: { value: 'https://cdn.example/passport.pdf' },
    });

    mockApi.get.mockResolvedValue({
      instance,
      items: items.map(i => (i.id === 'it-doc' ? { ...i, status: 'done' } : i)),
    });

    fireEvent.click(submit);
    await waitFor(() =>
      expect(mockApi.uploadItemDocument).toHaveBeenCalledWith('it-doc', {
        file_name: 'passport.pdf',
        file_url: 'https://cdn.example/passport.pdf',
      }),
    );
    await waitFor(() => expect(screen.getByText('2 of 5 steps done')).toBeInTheDocument());
  });
});
