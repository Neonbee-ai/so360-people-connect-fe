import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../../services/payrollApi', () => ({
  payrollApi: {
    statutory: { get: vi.fn(), update: vi.fn() },
  },
}));

import StatutoryTab from './StatutoryTab';
import { payrollApi } from '../../../services/payrollApi';
import { toast } from '@so360/design-system';

const mockApi = payrollApi as any;
const config = {
  pack: 'india',
  enabled: true,
  config: {
    pf: { enabled: true, wage_ceiling: 15000, employee_rate: 12, employer_rate: 12, eps_rate: 8.33, restrict_to_ceiling: true },
    esi: { enabled: true, wage_ceiling: 21000, employee_rate: 0.75, employer_rate: 3.25 },
    pt: { enabled: true, state: 'KL' },
    lwf: { enabled: true, state: 'KL', employee_amount: 20, employer_amount: 20 },
    tds: { enabled: true, default_regime: 'new', slabs_fy: '2026-27', standard_deduction: 75000 },
    gratuity: { enabled: false, rate_days: 15 },
    identifiers: [{ key: 'pan', label: 'PAN', required_for_payroll: true, masked: false }],
  },
};
const clone = () => JSON.parse(JSON.stringify(config));

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
  mockApi.statutory.get.mockResolvedValue(clone());
});

describe('GIVEN the Comb statutory tab', () => {
  it('WHEN it loads THEN the section cards, identifiers and Save action render', async () => {
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('Gratuity')).toBeInTheDocument());
    expect(screen.getByText('Employee Identifiers')).toBeInTheDocument();
    expect(screen.getByText('Save Statutory Config')).toBeInTheDocument();
  });

  it('WHEN the config is missing THEN no save action is offered', async () => {
    mockApi.statutory.get.mockResolvedValue(null);
    render(<StatutoryTab />);
    await waitFor(() => expect(mockApi.statutory.get).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Save Statutory Config')).not.toBeInTheDocument());
  });

  it('WHEN gratuity is disabled THEN its rate field is gated off', async () => {
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('Gratuity')).toBeInTheDocument());
    expect(screen.queryByText('Rate (days/year)')).not.toBeInTheDocument();
  });

  it('WHEN Save is clicked THEN statutory.update receives the config', async () => {
    mockApi.statutory.update.mockImplementation(async (d: any) => d);
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('Save Statutory Config')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Statutory Config'));
    await waitFor(() => expect(mockApi.statutory.update).toHaveBeenCalled());
    expect(mockApi.statutory.update.mock.calls[0][0].config.pf).toMatchObject({ enabled: true, wage_ceiling: 15000 });
  });

  it('WHEN saving fails THEN an error toast is shown', async () => {
    mockApi.statutory.update.mockRejectedValue(new Error('x'));
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('Save Statutory Config')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Statutory Config'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save statutory configuration'));
  });
});
