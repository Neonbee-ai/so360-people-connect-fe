import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../../services/payrollApi', () => ({
  payrollApi: {
    settings: { get: vi.fn(), update: vi.fn() },
  },
}));

import SettingsTab from './SettingsTab';
import { payrollApi } from '../../../services/payrollApi';
import { toast } from '@so360/design-system';

const mockApi = payrollApi as any;
const base = { id: 'set1', pay_frequency: 'monthly', pay_day_rule: { type: 'last_working_day' }, working_days_basis: 'calendar_days', lop_calculation: 'per_day_gross', payslip_number_format: 'PS-{YYYY}{MM}-{SEQ}', attendance_cutoff_day: 25 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
  mockApi.settings.get.mockResolvedValue({ ...base });
});

describe('GIVEN the Comb payroll settings tab', () => {
  it('WHEN it loads THEN the form is populated and Save Settings renders', async () => {
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Pay Frequency')).toBeInTheDocument());
    expect(screen.getByDisplayValue('PS-{YYYY}{MM}-{SEQ}')).toBeInTheDocument();
    expect(screen.getByText('Save Settings')).toBeInTheDocument();
  });

  it('WHEN settings are missing THEN the empty state renders', async () => {
    mockApi.settings.get.mockResolvedValue(null);
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Payroll settings are not available yet.')).toBeInTheDocument());
  });

  it('WHEN the pay day rule is not fixed day THEN the Pay Day field is gated off, and Save sends the form', async () => {
    mockApi.settings.update.mockResolvedValue({ ...base });
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Save Settings')).toBeInTheDocument());
    expect(screen.queryByText('Pay Day (1–28)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Save Settings'));
    await waitFor(() => expect(mockApi.settings.update).toHaveBeenCalledWith(expect.objectContaining({ pay_frequency: 'monthly', attendance_cutoff_day: 25 })));
  });

  it('WHEN saving fails THEN an error toast is shown', async () => {
    mockApi.settings.update.mockRejectedValue(new Error('x'));
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Save Settings')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Settings'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save payroll settings'));
  });
});
