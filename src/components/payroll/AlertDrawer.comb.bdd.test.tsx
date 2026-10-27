import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: { alerts: { employees: vi.fn() } },
}));

import AlertDrawer from './AlertDrawer';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;
const alert = { key: 'missing_bank', label: 'Missing bank details', description: 'Add bank info', count: 1 };

const renderDrawer = (a: any = alert, onClose = vi.fn()) =>
  render(<MemoryRouter><AlertDrawer alert={a} onClose={onClose} /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GIVEN the Comb AlertDrawer', () => {
  it('WHEN alert is null THEN nothing renders', () => {
    renderDrawer(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('WHEN opened THEN the dialog shows the alert label and count', async () => {
    mockApi.alerts.employees.mockResolvedValue({ data: [] });
    renderDrawer();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Missing bank details')).toBeInTheDocument();
    expect(screen.getByText('1 employee affected')).toBeInTheDocument();
    await waitFor(() => expect(mockApi.alerts.employees).toHaveBeenCalledWith('missing_bank'));
  });

  it('WHEN employees load THEN each shows info and a Fix link to the payroll tab', async () => {
    mockApi.alerts.employees.mockResolvedValue({
      data: [{ person_id: 'p1', person_name: 'Asha Nair', employee_code: 'E1', department_name: 'Eng', detail: 'No IBAN' }],
    });
    renderDrawer();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    expect(screen.getByText('E1 · Eng')).toBeInTheDocument();
    expect(screen.getByText('No IBAN')).toBeInTheDocument();
    expect(screen.getByText('Fix').closest('a')).toHaveAttribute('href', '/people/people/p1?tab=payroll');
  });

  it('WHEN no employees remain THEN the resolved message shows', async () => {
    mockApi.alerts.employees.mockResolvedValue({ data: [] });
    renderDrawer();
    await waitFor(() => expect(screen.getByText('No employees remaining — this alert is resolved.')).toBeInTheDocument());
  });

  it('WHEN Close is clicked THEN onClose fires', async () => {
    mockApi.alerts.employees.mockResolvedValue({ data: [] });
    const onClose = vi.fn();
    renderDrawer(alert, onClose);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(mockApi.alerts.employees).toHaveBeenCalled());
  });
});
