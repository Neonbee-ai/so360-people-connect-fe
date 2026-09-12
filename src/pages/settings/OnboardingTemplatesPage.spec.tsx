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
      listStandardTemplates: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      seedStandardTemplates: vi.fn().mockResolvedValue({ created: [], created_count: 0, skipped: [], skipped_count: 0, has_default: false }),
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

describe('Given the NeonBee standard template catalog', () => {
  const CATALOG = [
    { key: 'standard_employee', name: 'Standard Employee Onboarding', description: 'General purpose', is_default: true, step_count: 15, already_seeded: false },
    { key: 'sales_employee', name: 'Sales Employee Onboarding', description: 'For sales hires', is_default: false, step_count: 16, already_seeded: false },
    { key: 'intern', name: 'Intern / Trainee Onboarding', description: 'Shorter', is_default: false, step_count: 10, already_seeded: true },
  ];

  const openCatalog = async () => {
    mockApi.listStandardTemplates.mockResolvedValue({ data: CATALOG, total: 3 });
    renderPage();
    await waitFor(() => expect(screen.getByText('Onboarding Templates')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /standard templates/i }));
    await waitFor(() => expect(screen.getByText('Standard Employee Onboarding')).toBeInTheDocument());
  };

  it('When the catalog opens / Then each entry shows its name and step count', async () => {
    await openCatalog();
    expect(screen.getByText('Sales Employee Onboarding')).toBeInTheDocument();
    expect(screen.getByText('15 steps')).toBeInTheDocument();
  });

  it('When entries are already seeded / Then they are flagged and excluded from the selection', async () => {
    await openCatalog();
    expect(screen.getByText('Already added')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add 2 templates/i }));

    await waitFor(() =>
      expect(mockApi.seedStandardTemplates).toHaveBeenCalledWith(['standard_employee', 'sales_employee']),
    );
  });

  it('When an entry is deselected / Then it is not sent to the seeder', async () => {
    await openCatalog();

    fireEvent.click(screen.getByText('Sales Employee Onboarding'));
    fireEvent.click(screen.getByRole('button', { name: /add 1 template/i }));

    await waitFor(() =>
      expect(mockApi.seedStandardTemplates).toHaveBeenCalledWith(['standard_employee']),
    );
  });

  it('When seeding succeeds / Then the template list is reloaded', async () => {
    await openCatalog();
    mockApi.seedStandardTemplates.mockResolvedValue({
      created: [{ id: 'new-1', key: 'standard_employee', name: 'Standard Employee Onboarding' }],
      created_count: 1, skipped: [], skipped_count: 0, has_default: true,
    });
    const callsBefore = mockApi.listTemplates.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: /add 2 templates/i }));

    await waitFor(() =>
      expect(mockApi.listTemplates.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('When every entry is already seeded / Then the drawer says so instead of showing an empty list', async () => {
    mockApi.listStandardTemplates.mockResolvedValue({
      data: CATALOG.map(t => ({ ...t, already_seeded: true })),
      total: 3,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Onboarding Templates')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /standard templates/i }));

    await waitFor(() =>
      expect(screen.getByText(/already added every standard template/i)).toBeInTheDocument(),
    );
  });

  it('When the catalog fails to load / Then a retry is offered rather than a silent empty drawer', async () => {
    mockApi.listStandardTemplates.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Onboarding Templates')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /standard templates/i }));

    await waitFor(() =>
      expect(screen.getByText(/Unable to load the standard templates/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('When the viewer lacks onboarding.manage / Then the standard-template action is hidden', async () => {
    mockShell = { permissionsLoaded: true, hasPermission: (c: string) => c !== 'onboarding.manage' };
    renderPage();
    await waitFor(() => expect(screen.getByText('Onboarding Templates')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /standard templates/i })).not.toBeInTheDocument();
  });
});

describe('Given templates exist but none is the organization default', () => {
  it('When the page loads / Then it warns that new hires will not get a checklist automatically', async () => {
    mockApi.listTemplates.mockResolvedValue({
      data: [{ id: 't1', name: 'Engineering New Hire', description: null, is_default: false, is_active: true }],
      total: 1,
    });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('No default onboarding template')).toBeInTheDocument(),
    );
  });

  it('Given a default IS set / When the page loads / Then no warning is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());

    expect(screen.queryByText('No default onboarding template')).not.toBeInTheDocument();
  });
});
