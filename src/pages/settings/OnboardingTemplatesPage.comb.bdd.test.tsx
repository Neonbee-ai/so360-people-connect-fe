import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';

vi.mock('../../services/onboardingService', async () => {
  const actual = await vi.importActual<any>('../../services/onboardingService');
  return {
    ...actual,
    onboardingApi: {
      listTemplates: vi.fn(),
      listStandardTemplates: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      seedStandardTemplates: vi.fn(),
      getTemplate: vi.fn(),
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
    },
  };
});

let mockShell: any;
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => mockShell }));

import OnboardingTemplatesPage from './OnboardingTemplatesPage';
import { onboardingApi } from '../../services/onboardingService';

const api = onboardingApi as any;
const renderPage = () => render(<MemoryRouter><OnboardingTemplatesPage /></MemoryRouter>);

describe('OnboardingTemplatesPage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShell = { permissionsLoaded: true, hasPermission: () => true };
    api.listTemplates.mockResolvedValue({ data: [
      { id: 't1', name: 'Engineering New Hire', description: 'Devs', is_default: true, is_active: true },
      { id: 't2', name: 'Sales New Hire', description: null, is_default: false, is_active: false },
    ], total: 2 });
  });

  it('Given templates exist / When loaded / Then title, rows and actions render', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Onboarding Templates' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /New Template/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Standard Templates/ })).toBeInTheDocument();
  });

  it('Given no templates / When loaded / Then the empty state offers the standard catalog', async () => {
    api.listTemplates.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No onboarding templates')).toBeInTheDocument());
    expect(screen.getByText('Use a Standard Template')).toBeInTheDocument();
  });

  it('Given the viewer cannot manage / When loaded / Then write actions are hidden', async () => {
    mockShell = { permissionsLoaded: true, hasPermission: (c: string) => c !== 'onboarding.manage' };
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /New Template/ })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
  });

  it('Given no default template / When loaded / Then a warning alert shows', async () => {
    api.listTemplates.mockResolvedValue({ data: [{ id: 't1', name: 'Eng', description: null, is_default: false, is_active: true }], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No default onboarding template')).toBeInTheDocument());
  });

  it('Given the template drawer is open / When Cancel is clicked / Then it closes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering New Hire')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New Template/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Given the API fails / When loading / Then an error toast is raised', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.listTemplates.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalled());
  });
});
