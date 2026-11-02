import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { toast } from '@so360/design-system';
import LeaveTypesPage from './LeaveTypesPage';

const mockGetAll = vi.fn();
const mockCreate = vi.fn();
let flagEnabled = true;

vi.mock('../services/leaveTypesService', () => ({
  leaveTypesApi: {
    getAll: (...a: unknown[]) => mockGetAll(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    update: vi.fn(),
  },
}));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => flagEnabled }),
}));

const lt = { id: 'lt1', code: 'AL', name: 'Annual Leave', is_paid: true, requires_approval: true, accrual_type: 'annual', max_days_per_year: 20, carry_forward_allowed: false, is_active: true, color: '#10b981' };

describe('LeaveTypesPage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagEnabled = true;
    mockGetAll.mockResolvedValue({ data: [lt] });
  });

  it('Given the page loads / When data arrives / Then title and primary action render', async () => {
    render(<LeaveTypesPage />);
    expect(screen.getByRole('heading', { name: 'Leave Types' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create Leave Type/ })).toBeInTheDocument();
  });

  it('Given no leave types / When loaded / Then the empty state shows', async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    render(<LeaveTypesPage />);
    await waitFor(() => expect(screen.getByText('No leave types found')).toBeInTheDocument());
  });

  it('Given the create flag is off / When rendered / Then no create or edit actions show', async () => {
    flagEnabled = false;
    render(<LeaveTypesPage />);
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Create Leave Type/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('Given the modal is open / When Cancel is clicked / Then it closes', async () => {
    render(<LeaveTypesPage />);
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Create Leave Type/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Given loading fails / When the page loads / Then an error toast shows', async () => {
    const errSpy = vi.spyOn(toast, 'error');
    mockGetAll.mockRejectedValue(new Error('boom'));
    render(<LeaveTypesPage />);
    await waitFor(() => expect(errSpy).toHaveBeenCalledWith('Failed to load leave types'));
  });
});
