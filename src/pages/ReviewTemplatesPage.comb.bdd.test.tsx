import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';
import ReviewTemplatesPage from './ReviewTemplatesPage';
import { reviewTemplatesApi } from '../services/reviewTemplatesService';

vi.mock('../services/reviewTemplatesService', () => ({
  reviewTemplatesApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), clone: vi.fn() },
}));
let flagEnabled = true;
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => flagEnabled, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    toBusinessDate: (d: any) => String(d).slice(0, 10), businessToday: () => '2026-09-15',
    startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`), endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
    formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}`, formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

const api = reviewTemplatesApi as any;
const tpl = { id: 'tpl1', name: 'Annual 2024', review_type: 'annual', rating_scale: 5, requires_self_review: true, requires_manager_review: true, is_active: true, sections: [], created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' };
const renderPage = () => render(<MemoryRouter><ReviewTemplatesPage /></MemoryRouter>);

describe('ReviewTemplatesPage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagEnabled = true;
    api.getAll.mockResolvedValue({ data: [tpl], total: 1 });
  });

  it('Given templates exist / When loaded / Then title, row and primary action render', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Review Templates' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Annual 2024')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create Template/ })).toBeInTheDocument();
  });

  it('Given no templates / When loaded / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No review templates found')).toBeInTheDocument());
  });

  it('Given the create flag is off / When loaded / Then create and edit actions are hidden', async () => {
    flagEnabled = false;
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual 2024')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Create Template/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('Given an empty list / When Create Template is clicked / Then the create dialog opens (not hidden by the empty state)', async () => {
    api.getAll.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No review templates found')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /Create Template/ })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Given the create modal is open / When Cancel is clicked / Then it closes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Annual 2024')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Create Template/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Given the API fails / When loading / Then an error toast is raised', async () => {
    const spy = vi.spyOn(toast, 'error');
    api.getAll.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to load review templates'));
  });
});
