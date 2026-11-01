import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';
import GoalsPage, { goalUnitOptions, GOAL_UNITS } from './GoalsPage';
import { goalsApi } from '../services/goalsService';
import { peopleApi } from '../services/peopleService';

vi.mock('../services/goalsService', () => ({
  goalsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateProgress: vi.fn(), complete: vi.fn() },
}));
vi.mock('../services/peopleService', () => ({ peopleApi: { getAll: vi.fn().mockResolvedValue({ data: [] }), getMe: vi.fn().mockResolvedValue({ id: 'p-me' }) } }));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false, currentTenant: { id: 'tenant-1' }, currentOrg: { id: 'org-1' }, user: { id: 'u1', email: 'a@b.com' }, accessToken: 'tok' }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false }),
}));
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({
    toBusinessDate: (d: any) => String(d).slice(0, 10), businessToday: () => '2026-09-15',
    formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}`, formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

const api = goalsApi as any;
const renderPage = () => render(<MemoryRouter><GoalsPage /></MemoryRouter>);

describe('Goals fixes (Pulse 3900d9c0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAll.mockResolvedValue({ data: [], total: 0 });
  });

  it('Given no goals / When the page loads / Then exactly one Create Goal button is offered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No goals found')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Create Goal/ })).toHaveLength(1);
  });

  it('Given the create dialog / When it opens / Then Unit is a dropdown of fixed units', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No goals found')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Create Goal/ }));
    const unit = screen.getByLabelText(/Unit/) as HTMLSelectElement;
    expect(unit.tagName).toBe('SELECT');
    const values = Array.from(unit.options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['%', 'count', 'currency', 'hours', 'projects']));
  });

  it('Given a goal with a legacy free-text unit / When options are built / Then that unit is kept selectable', () => {
    expect(goalUnitOptions('deals').map((o) => o.value)).toContain('deals');
    expect(goalUnitOptions('%')).toBe(GOAL_UNITS);
    expect(goalUnitOptions(undefined)).toBe(GOAL_UNITS);
  });

  it('Given the server rejects a goal / When create fails / Then the server message is shown', async () => {
    api.create.mockRejectedValue(new Error('Target date must be after start date'));
    const spy = vi.spyOn(toast, 'error');
    renderPage();
    await waitFor(() => expect(screen.getByText('No goals found')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Create Goal/ }));
    await waitFor(() => expect((peopleApi as any).getMe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Ship v2' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.stringContaining('Target date must be after start date')));
    spy.mockRestore();
  });
});
