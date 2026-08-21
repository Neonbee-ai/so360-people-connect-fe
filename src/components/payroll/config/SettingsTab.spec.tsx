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

const mockApi = payrollApi as any;

const baseSettings = {
  id: 'set1',
  pay_frequency: 'monthly',
  pay_day_rule: { type: 'last_working_day' },
  working_days_basis: 'calendar_days',
  lop_calculation: 'per_day_gross',
  payslip_number_format: 'PS-{YYYY}{MM}-{SEQ}',
  attendance_cutoff_day: 25,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.settings.get.mockResolvedValue({ ...baseSettings });
});

describe('GIVEN the payroll settings tab', () => {
  it('WHEN it loads THEN the form is populated from the API and business-settings currency is shown read-only', async () => {
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Pay Frequency')).toBeInTheDocument());
    expect(screen.getByDisplayValue('PS-{YYYY}{MM}-{SEQ}')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByText(/Business Settings/)).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('WHEN Save Settings is clicked THEN the current form is sent to the update API', async () => {
    mockApi.settings.update.mockResolvedValue({ ...baseSettings });
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Save Settings')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Settings'));
    await waitFor(() => expect(mockApi.settings.update).toHaveBeenCalledWith(expect.objectContaining({
      pay_frequency: 'monthly',
      working_days_basis: 'calendar_days',
    })));
  });

  it('WHEN the pay day rule switches to fixed day THEN the day field appears and is saved', async () => {
    mockApi.settings.update.mockResolvedValue({ ...baseSettings, pay_day_rule: { type: 'fixed_day', day: 15 } });
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Pay Day Rule')).toBeInTheDocument());
    expect(screen.queryByText('Pay Day (1–28)')).not.toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Last working day of the period'), { target: { value: 'fixed_day' } });
    await waitFor(() => expect(screen.getByText('Pay Day (1–28)')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('28'), { target: { value: '15' } });
    fireEvent.click(screen.getByText('Save Settings'));
    await waitFor(() => expect(mockApi.settings.update).toHaveBeenCalledWith(expect.objectContaining({
      pay_day_rule: { type: 'fixed_day', day: 15 },
    })));
  });

  it('WHEN the rule switches back to last working day THEN the day field disappears', async () => {
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Pay Day Rule')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('Last working day of the period'), { target: { value: 'fixed_day' } });
    await waitFor(() => expect(screen.getByText('Pay Day (1–28)')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('Fixed day of the month'), { target: { value: 'last_working_day' } });
    await waitFor(() => expect(screen.queryByText('Pay Day (1–28)')).not.toBeInTheDocument());
  });

  it('WHEN other policy fields change THEN each lands in the saved payload', async () => {
    mockApi.settings.update.mockResolvedValue({ ...baseSettings });
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Working Days Basis')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('Calendar days'), { target: { value: 'fixed_30' } });
    fireEvent.change(screen.getByDisplayValue('Per-day gross'), { target: { value: 'per_day_basic' } });
    fireEvent.change(screen.getByDisplayValue('PS-{YYYY}{MM}-{SEQ}'), { target: { value: 'PAY-{SEQ}' } });
    fireEvent.change(screen.getByDisplayValue('25'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save Settings'));
    await waitFor(() => expect(mockApi.settings.update).toHaveBeenCalledWith(expect.objectContaining({
      working_days_basis: 'fixed_30',
      lop_calculation: 'per_day_basic',
      payslip_number_format: 'PAY-{SEQ}',
      attendance_cutoff_day: null,
    })));
  });

  it('WHEN the save fails THEN the button returns to its idle state', async () => {
    mockApi.settings.update.mockRejectedValue(new Error('nope'));
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Save Settings')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Settings'));
    await waitFor(() => expect(mockApi.settings.update).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Save Settings')).toBeInTheDocument());
  });

  it('WHEN the settings API fails THEN an unavailable message renders instead of the form', async () => {
    mockApi.settings.get.mockRejectedValue(new Error('down'));
    render(<SettingsTab />);
    await waitFor(() => expect(screen.getByText('Payroll settings are not available yet.')).toBeInTheDocument());
  });
});
