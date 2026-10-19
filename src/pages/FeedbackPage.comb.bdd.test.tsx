import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';
import FeedbackPage from './FeedbackPage';
import { feedbackApi } from '../services/feedbackService';

vi.mock('../services/feedbackService', () => ({ feedbackApi: { getAll: vi.fn(), create: vi.fn(), acknowledge: vi.fn() } }));
vi.mock('../services/peopleService', () => ({ peopleApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('../services/apiClient', () => ({ apiContext: { getUserId: () => 'u1' } }));
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

const api = feedbackApi as any;
const fb = { id: 'fb1', feedback_type: 'positive', feedback_text: 'Excellent work', is_anonymous: false, is_visible_to_subject: true, overall_rating: 5, acknowledged_at: null, created_at: '2025-01-15', provider_relationship: 'peer', strengths: 'Leadership', areas_for_improvement: 'Communication', person: { id: 'p1', full_name: 'Alice' }, provider: { id: 'u1', full_name: 'Bob' } };
const renderPage = () => render(<MemoryRouter><FeedbackPage /></MemoryRouter>);

describe('FeedbackPage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagEnabled = true;
    api.getAll.mockResolvedValue({ data: [fb] });
  });

  it('Given feedback exists / When loaded / Then title, message and primary action render', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Feedback' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Excellent work')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Give Feedback/ })).toBeInTheDocument();
  });

  it('Given no feedback / When loaded / Then the empty state shows', async () => {
    api.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No feedback yet')).toBeInTheDocument());
  });

  it('Given the create flag is off / When loaded / Then Give Feedback is hidden', async () => {
    flagEnabled = false;
    renderPage();
    await waitFor(() => expect(screen.getByText('Excellent work')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Give Feedback/ })).not.toBeInTheDocument();
  });

  it('Given the type filter / When changed / Then the API is called with that type', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Excellent work')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Type filter'), { target: { value: 'general' } });
    await waitFor(() => expect(api.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ feedback_type: 'general' })));
  });

  it('Given the modal is open / When Cancel is clicked / Then it closes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Excellent work')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Give Feedback/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
