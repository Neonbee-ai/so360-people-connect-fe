import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/leaveRequestsService', () => ({
  leaveRequestsApi: { getById: vi.fn(), getBalances: vi.fn(), approve: vi.fn(), reject: vi.fn() },
  LeaveRequest: {},
  LeaveBalance: {},
}));

const perms = { approve: true };
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: () => true,
    hasPermission: () => perms.approve,
  }),
}));
vi.mock('../utils/formatters', () => ({
  usePeopleFormatters: () => ({ formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '' }),
}));

import LeaveRequestDetailPage from './LeaveRequestDetailPage';
import { leaveRequestsApi } from '../services/leaveRequestsService';
import { CombScope } from '@so360/design-system';

const api = leaveRequestsApi as any;

describe('LeaveRequestDetailPage trail (Comb)', () => {
  it('Given a request inside the People scope / When rendered / Then the module root crumb and the parent list crumb show', async () => {
    api.getById.mockResolvedValue({
      id: 'lr1', person_id: 'p1', leave_type_id: 'lt1', status: 'pending',
      start_date: '2026-07-01', end_date: '2026-07-02', total_days: 2, reason: 'Trip',
      person: { full_name: 'Alice' }, leave_type: { name: 'Annual Leave' }, approvals: [],
    });
    api.getBalances.mockResolvedValue({ data: [] });
    render(
      <MemoryRouter initialEntries={['/leaves/requests/lr1']}>
        <CombScope module="people" root={{ label: 'People', to: '/people' }} navigate={() => {}}>
          <Routes><Route path="/leaves/requests/:id" element={<LeaveRequestDetailPage />} /></Routes>
        </CombScope>
      </MemoryRouter>,
    );
    expect(await screen.findByText('People')).toBeInTheDocument();
    expect(await screen.findByText('Leave Requests')).toBeInTheDocument();
  });
});
