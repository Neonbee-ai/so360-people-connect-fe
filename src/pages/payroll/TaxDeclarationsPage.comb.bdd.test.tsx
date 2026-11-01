import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: {
    taxDeclarations: { list: vi.fn() },
    employees: {
      taxDeclarations: { get: vi.fn(), reviewItem: vi.fn(), review: vi.fn() },
    },
  },
}));

import TaxDeclarationsPage from './TaxDeclarationsPage';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;

const listRow = {
  id: 'd1', person_id: 'p1', person_name: 'Asha Nair',
  fiscal_year: '2026-27', regime: 'old', status: 'submitted', total_declared: 150000,
};

const fullDeclaration = {
  ...listRow,
  items: [
    { id: 'i1', category: '80C', description: 'LIC premium', declared_amount: 100000, status: 'pending' },
    { id: 'i2', category: '80D', declared_amount: 50000, approved_amount: 40000, status: 'pending' },
  ],
};

const renderPage = () => render(<MemoryRouter><TaxDeclarationsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.taxDeclarations.list.mockResolvedValue({ data: [listRow], total: 1 });
  mockApi.employees.taxDeclarations.get.mockResolvedValue(fullDeclaration);
});


describe('GIVEN the Comb tax declarations review queue', () => {
  it('WHEN it loads THEN rows render inside the list template with a Review action', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    expect(screen.getByText('Tax Declarations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
  });

  it('WHEN Review is clicked THEN the drawer opens with the declaration items', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText('LIC premium')).toBeInTheDocument();
    expect(mockApi.employees.taxDeclarations.get).toHaveBeenCalledWith('p1', '2026-27');
  });

  it('WHEN the drawer Approve is clicked THEN the declaration is approved and the drawer closes', async () => {
    mockApi.employees.taxDeclarations.review.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Approve$/ }));
    await waitFor(() => expect(mockApi.employees.taxDeclarations.review).toHaveBeenCalledWith('p1', '2026-27', { action: 'approve', notes: undefined }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('WHEN the drawer Close is clicked THEN the drawer is dismissed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
