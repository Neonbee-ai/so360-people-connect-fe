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

describe('GIVEN the tax declarations review queue', () => {
  it('WHEN the page loads THEN each declaration row shows employee, FY, regime, declared total and status', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    expect(screen.getByText('2026-27')).toBeInTheDocument();
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('$150,000.00')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('WHEN filters change THEN the list reloads with fiscal year and status params', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('2026-27'), { target: { value: '2025-26' } });
    await waitFor(() =>
      expect(mockApi.taxDeclarations.list).toHaveBeenCalledWith({ fiscal_year: '2025-26', status: undefined }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'approved' } });
    await waitFor(() =>
      expect(mockApi.taxDeclarations.list).toHaveBeenCalledWith({ fiscal_year: '2025-26', status: 'approved' }));
  });

  it('WHEN there are no declarations THEN a friendly empty state renders', async () => {
    mockApi.taxDeclarations.list.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText('No tax declarations')).toBeInTheDocument());
  });

  it('WHEN the list API fails THEN the page falls back to the empty state', async () => {
    mockApi.taxDeclarations.list.mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() => expect(screen.getByText('No tax declarations')).toBeInTheDocument());
  });
});

describe('GIVEN the declaration review drawer', () => {
  const openDrawer = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Review'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  };

  it('WHEN Review is clicked THEN the full declaration is fetched and items render with amounts', async () => {
    await openDrawer();
    expect(mockApi.employees.taxDeclarations.get).toHaveBeenCalledWith('p1', '2026-27');
    expect(screen.getByText('80C')).toBeInTheDocument();
    expect(screen.getByText('LIC premium')).toBeInTheDocument();
    expect(screen.getByText('$100,000.00')).toBeInTheDocument();
    // Item with an existing approved amount pre-fills the input
    expect((screen.getByLabelText('Approved amount for 80D') as HTMLInputElement).value).toBe('40000');
  });

  it('WHEN an item is approved with a typed amount THEN reviewItem is called with that amount', async () => {
    mockApi.employees.taxDeclarations.reviewItem.mockResolvedValue({});
    await openDrawer();
    fireEvent.change(screen.getByLabelText('Approved amount for 80C'), { target: { value: '90000' } });
    fireEvent.click(screen.getByLabelText('Approve 80C'));
    await waitFor(() =>
      expect(mockApi.employees.taxDeclarations.reviewItem).toHaveBeenCalledWith('p1', '2026-27', 'i1', {
        status: 'approved', approved_amount: 90000,
      }));
  });

  it('WHEN an item is rejected THEN reviewItem is called with rejected and no amount', async () => {
    mockApi.employees.taxDeclarations.reviewItem.mockResolvedValue({});
    await openDrawer();
    fireEvent.click(screen.getByLabelText('Reject 80C'));
    await waitFor(() =>
      expect(mockApi.employees.taxDeclarations.reviewItem).toHaveBeenCalledWith('p1', '2026-27', 'i1', {
        status: 'rejected', approved_amount: undefined,
      }));
  });

  it('WHEN an item review fails THEN the drawer survives the error', async () => {
    mockApi.employees.taxDeclarations.reviewItem.mockRejectedValue(new Error('nope'));
    await openDrawer();
    fireEvent.click(screen.getByLabelText('Approve 80C'));
    await waitFor(() => expect(mockApi.employees.taxDeclarations.reviewItem).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('WHEN the overall Approve decision is made with notes THEN review is called and the list reloads', async () => {
    mockApi.employees.taxDeclarations.review.mockResolvedValue({});
    await openDrawer();
    fireEvent.change(document.querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'All proofs fine' } });
    fireEvent.click(screen.getByRole('button', { name: /^Approve$/ }));
    await waitFor(() =>
      expect(mockApi.employees.taxDeclarations.review).toHaveBeenCalledWith('p1', '2026-27', {
        action: 'approve', notes: 'All proofs fine',
      }));
    // Drawer closes after a decision
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockApi.taxDeclarations.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('WHEN Reject is chosen without notes THEN review is called with undefined notes', async () => {
    mockApi.employees.taxDeclarations.review.mockResolvedValue({});
    await openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Reject$/ }));
    await waitFor(() =>
      expect(mockApi.employees.taxDeclarations.review).toHaveBeenCalledWith('p1', '2026-27', {
        action: 'reject', notes: undefined,
      }));
  });

  it('WHEN Reopen is chosen THEN review is called with the reopen action', async () => {
    mockApi.employees.taxDeclarations.review.mockResolvedValue({});
    await openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Reopen/ }));
    await waitFor(() =>
      expect(mockApi.employees.taxDeclarations.review).toHaveBeenCalledWith('p1', '2026-27', {
        action: 'reopen', notes: undefined,
      }));
  });

  it('WHEN the decision API fails THEN the drawer stays open', async () => {
    mockApi.employees.taxDeclarations.review.mockRejectedValue(new Error('nope'));
    await openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /^Approve$/ }));
    await waitFor(() => expect(mockApi.employees.taxDeclarations.review).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('WHEN the declaration has no items THEN the drawer says so', async () => {
    mockApi.employees.taxDeclarations.get.mockResolvedValue({ ...listRow, items: [] });
    await openDrawer();
    expect(screen.getByText('No declaration items.')).toBeInTheDocument();
  });

  it('WHEN the Close control is used THEN the drawer disappears', async () => {
    await openDrawer();
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('WHEN loading the detail fails THEN no drawer opens', async () => {
    mockApi.employees.taxDeclarations.get.mockRejectedValue(new Error('nope'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Asha Nair')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Review'));
    await waitFor(() => expect(mockApi.employees.taxDeclarations.get).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
