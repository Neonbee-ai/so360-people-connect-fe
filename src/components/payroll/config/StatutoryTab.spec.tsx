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
    identifiers: [
      { key: 'pan', label: 'PAN', required_for_payroll: true, masked: false },
      { key: 'aadhaar', label: 'Aadhaar', required_for_payroll: false, masked: true },
      { key: 'custom_id', label: 'Custom ID', required_for_payroll: false },
    ],
  },
};

const clone = () => JSON.parse(JSON.stringify(config));

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.statutory.get.mockResolvedValue(clone());
});

describe('GIVEN the statutory configuration tab', () => {
  it('WHEN it loads THEN every statutory section renders with its enable toggle', async () => {
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('Provident Fund (PF)')).toBeInTheDocument());
    for (const title of ['Employee State Insurance (ESI)', 'Professional Tax (PT)', 'Labour Welfare Fund (LWF)', 'Income Tax (TDS)', 'Gratuity']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // Enabled PF + ESI sections both expose a wage-ceiling field
    expect(screen.getAllByText('Wage Ceiling')).toHaveLength(2);
    expect(screen.getByDisplayValue('15000')).toBeInTheDocument();
    // Disabled gratuity hides its fields
    expect(screen.queryByText('Rate (days/year)')).not.toBeInTheDocument();
  });

  it('WHEN identifiers render THEN each row shows label, required checkbox and masked flag', async () => {
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('Employee Identifiers')).toBeInTheDocument());
    expect(screen.getByText('PAN')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    expect(screen.getByText('Custom ID')).toBeInTheDocument();
    expect((screen.getByLabelText('PAN required for payroll') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Aadhaar required for payroll') as HTMLInputElement).checked).toBe(false);
    // Masked column: exactly one masked identifier
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getAllByText('No')).toHaveLength(2);
  });

  it('WHEN an identifier requirement is toggled and saved THEN the update carries the flipped flag', async () => {
    mockApi.statutory.update.mockImplementation(async (data: any) => data);
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByLabelText('Aadhaar required for payroll')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Aadhaar required for payroll'));
    fireEvent.click(screen.getByText('Save Statutory Config'));
    await waitFor(() => expect(mockApi.statutory.update).toHaveBeenCalled());
    const sent = mockApi.statutory.update.mock.calls[0][0];
    expect(sent.config.identifiers.find((i: any) => i.key === 'aadhaar').required_for_payroll).toBe(true);
  });

  it('WHEN a gratuity section is enabled THEN its rate field appears and edits flow into the save', async () => {
    mockApi.statutory.update.mockImplementation(async (data: any) => data);
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('Gratuity')).toBeInTheDocument());
    // Gratuity is the only disabled section: its enable toggle is the only
    // unchecked checkbox without an aria-label (identifier boxes are labelled).
    const gratuityToggle = screen.getAllByRole('checkbox')
      .find(t => !(t as HTMLInputElement).checked && !t.getAttribute('aria-label')) as HTMLInputElement;
    fireEvent.click(gratuityToggle);
    await waitFor(() => expect(screen.getByText('Rate (days/year)')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Save Statutory Config'));
    await waitFor(() => expect(mockApi.statutory.update).toHaveBeenCalled());
    const sent = mockApi.statutory.update.mock.calls[0][0];
    expect(sent.config.gratuity).toMatchObject({ enabled: true, rate_days: 20 });
  });

  it('WHEN PF fields are edited THEN the numeric values and ceiling checkbox land in the config', async () => {
    mockApi.statutory.update.mockImplementation(async (data: any) => data);
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByDisplayValue('15000')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('15000'), { target: { value: '18000' } });
    fireEvent.change(screen.getByDisplayValue('8.33'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Restrict to wage ceiling').previousSibling as Element);
    fireEvent.click(screen.getByText('Save Statutory Config'));
    await waitFor(() => expect(mockApi.statutory.update).toHaveBeenCalled());
    const sent = mockApi.statutory.update.mock.calls[0][0];
    expect(sent.config.pf).toMatchObject({ wage_ceiling: 18000, eps_rate: undefined, restrict_to_ceiling: false });
  });

  it('WHEN PT / LWF / TDS fields are edited THEN state uppercasing and regime select work', async () => {
    mockApi.statutory.update.mockImplementation(async (data: any) => data);
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByPlaceholderText('KL')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('KL'), { target: { value: 'mh' } });
    fireEvent.change(screen.getByDisplayValue('New regime'), { target: { value: 'old' } });
    fireEvent.change(screen.getByPlaceholderText('2026-27'), { target: { value: '2027-28' } });
    fireEvent.click(screen.getByText('Save Statutory Config'));
    await waitFor(() => expect(mockApi.statutory.update).toHaveBeenCalled());
    const sent = mockApi.statutory.update.mock.calls[0][0];
    expect(sent.config.pt.state).toBe('MH');
    expect(sent.config.tds).toMatchObject({ default_regime: 'old', slabs_fy: '2027-28' });
  });

  it('WHEN ESI rates, LWF amounts and the standard deduction are edited THEN each lands in the config', async () => {
    mockApi.statutory.update.mockImplementation(async (data: any) => data);
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByDisplayValue('21000')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('21000'), { target: { value: '25000' } });
    fireEvent.change(screen.getByDisplayValue('0.75'), { target: { value: '1' } });
    fireEvent.change(screen.getByDisplayValue('3.25'), { target: { value: '3.5' } });
    // LWF state + amounts (two inputs share the value 20)
    const lwfState = screen.getAllByRole('textbox').find(i => (i as HTMLInputElement).value === 'KL' && !i.getAttribute('placeholder')) as HTMLInputElement;
    fireEvent.change(lwfState, { target: { value: 'tn' } });
    const [lwfEmp, lwfEr] = screen.getAllByDisplayValue('20');
    fireEvent.change(lwfEmp, { target: { value: '25' } });
    fireEvent.change(lwfEr, { target: { value: '50' } });
    fireEvent.change(screen.getByDisplayValue('75000'), { target: { value: '50000' } });
    // PF employee/employer rates share the value 12
    const [pfEmp, pfEr] = screen.getAllByDisplayValue('12');
    fireEvent.change(pfEmp, { target: { value: '10' } });
    fireEvent.change(pfEr, { target: { value: '13' } });
    fireEvent.click(screen.getByText('Save Statutory Config'));
    await waitFor(() => expect(mockApi.statutory.update).toHaveBeenCalled());
    const sent = mockApi.statutory.update.mock.calls[0][0];
    expect(sent.config.esi).toMatchObject({ wage_ceiling: 25000, employee_rate: 1, employer_rate: 3.5 });
    expect(sent.config.lwf).toMatchObject({ state: 'TN', employee_amount: 25, employer_amount: 50 });
    expect(sent.config.tds.standard_deduction).toBe(50000);
    expect(sent.config.pf).toMatchObject({ employee_rate: 10, employer_rate: 13 });
  });

  it('WHEN a section is disabled THEN its fields disappear', async () => {
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('EPS Rate %')).toBeInTheDocument());
    // First section toggle = PF
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(screen.queryByText('EPS Rate %')).not.toBeInTheDocument());
  });

  it('WHEN saving fails THEN the button returns to idle', async () => {
    mockApi.statutory.update.mockRejectedValue(new Error('nope'));
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('Save Statutory Config')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Statutory Config'));
    await waitFor(() => expect(mockApi.statutory.update).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Save Statutory Config')).toBeInTheDocument());
  });

  it('WHEN the statutory pack is not provisioned THEN the unavailable empty state renders', async () => {
    mockApi.statutory.get.mockRejectedValue(new Error('404'));
    render(<StatutoryTab />);
    await waitFor(() => expect(screen.getByText('Statutory pack unavailable')).toBeInTheDocument());
  });
});
