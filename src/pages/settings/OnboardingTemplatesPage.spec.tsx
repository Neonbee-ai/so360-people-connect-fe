import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * OnboardingTemplatesPage — BDD specs.
 *
 * The admin builder for new-hire checklists. The behaviours worth pinning:
 * the list renders from the API, the create drawer opens with one blank item
 * row, rows can be added, and save derives sort_order from row position
 * (the replace-all PATCH contract on the backend).
 */

vi.mock('../../services/onboardingService', async () => {
  const actual = await vi.importActual<any>('../../services/onboardingService');
  return {
    ...actual,
    onboardingApi: {
      listTemplates: vi.fn(),
      getTemplate: vi.fn(),
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
    },
  };
});

let mockShell: any;

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => mockShell,
}));

import OnboardingTemplatesPage from './OnboardingTemplatesPage';
import { onboardingApi } from '../../services/onboardingService';

const mockApi = onboardingApi as any;

const renderPage = () =>
  render(
    <MemoryRouter>
      <OnboardingTemplatesPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockShell = { permissionsLoaded: true, hasPermission: () => true };
  mockApi.listTemplates.mockResolvedValue({
    data: [
      { id: 't1', name: 'Engineering New Hire', description: 'Devs', is_default: true, is_active: true },
      { id: 't2', name: 'Sales New Hire', description: null, is_default: false, is_active: false },
    ],
    total: 2,
  });
});

describe('Given onboarding templates exist', () => {
  it('When the page loads / Then the templates table renders with default and status markers', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    expect(screen.getByText('Sales New Hire')).toBeInTheDocument();
    // 'Default' appears as both the column header and t1's pill.
    expect(screen.getAllByText('Default').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('When New Template is clicked / Then the drawer opens with one blank item row', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Template'));
    await waitFor(() => expect(screen.getByText('New Onboarding Template')).toBeInTheDocument());
    expect(screen.getByLabelText('Item 1 title')).toBeInTheDocument();
  });

  it('When Add Item is clicked / Then a second item row appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Template'));
    await waitFor(() => expect(screen.getByLabelText('Item 1 title')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Item'));
    expect(screen.getByLabelText('Item 2 title')).toBeInTheDocument();
  });

  it('When the form is saved / Then sort_order comes from row position and blank rows are dropped', async () => {
    mockApi.createTemplate.mockResolvedValue({ id: 't3', items: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Template'));
    await waitFor(() => expect(screen.getByText('New Onboarding Template')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('e.g. Engineering New Hire'), {
      target: { value: 'Ops New Hire' },
    });
    fireEvent.change(screen.getByLabelText('Item 1 title'), { target: { value: 'Collect passport' } });
    fireEvent.change(screen.getByLabelText('Item 1 type'), { target: { value: 'document_upload' } });
    fireEvent.change(screen.getByLabelText('Item 1 assignee'), { target: { value: 'employee' } });
    // Second row stays blank — it must not reach the API.
    fireEvent.click(screen.getByText('Add Item'));

    fireEvent.click(screen.getByText('Create Template'));

    await waitFor(() => expect(mockApi.createTemplate).toHaveBeenCalledTimes(1));
    const payload = mockApi.createTemplate.mock.calls[0][0];
    expect(payload.name).toBe('Ops New Hire');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      title: 'Collect passport',
      item_type: 'document_upload',
      assignee_role: 'employee',
      sort_order: 0,
    });
  });

  it('When Edit is clicked / Then the drawer loads the template detail (items live on the detail endpoint)', async () => {
    mockApi.getTemplate.mockResolvedValue({
      id: 't1',
      name: 'Engineering New Hire',
      description: 'Devs',
      is_default: true,
      is_active: true,
      items: [
        { id: 'i2', template_id: 't1', title: 'Second step', description: null, item_type: 'task', assignee_role: 'hr', sort_order: 1, is_required: true, due_days_offset: null, document_type: null, sign_document_ref: null },
        { id: 'i1', template_id: 't1', title: 'First step', description: null, item_type: 'task', assignee_role: 'hr', sort_order: 0, is_required: true, due_days_offset: null, document_type: null, sign_document_ref: null },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    fireEvent.click(screen.getAllByTitle('Edit')[0]);
    await waitFor(() => expect(mockApi.getTemplate).toHaveBeenCalledWith('t1'));
    // Rows are ordered by sort_order regardless of API order.
    await waitFor(() =>
      expect((screen.getByLabelText('Item 1 title') as HTMLInputElement).value).toBe('First step'),
    );
    expect((screen.getByLabelText('Item 2 title') as HTMLInputElement).value).toBe('Second step');
  });

  it('When Delete is clicked / Then a confirmation gates the destructive call', async () => {
    mockApi.deleteTemplate.mockResolvedValue({ deleted: true, deactivated: false });
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    fireEvent.click(screen.getAllByTitle('Delete')[0]);
    expect(mockApi.deleteTemplate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete Template'));
    await waitFor(() => expect(mockApi.deleteTemplate).toHaveBeenCalledWith('t1'));
  });
});

describe('Given a viewer without onboarding.manage', () => {
  it('When the page loads / Then create and row actions are hidden', async () => {
    mockShell = { permissionsLoaded: true, hasPermission: (code: string) => code !== 'onboarding.manage' };
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    expect(screen.queryByText('New Template')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });
});
