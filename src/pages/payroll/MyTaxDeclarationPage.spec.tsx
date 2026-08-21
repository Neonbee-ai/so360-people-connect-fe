import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/payrollApi', () => ({
  payrollApi: {
    my: {
      taxDeclarations: { get: vi.fn(), save: vi.fn(), submit: vi.fn() },
    },
  },
}));

import MyTaxDeclarationPage, { currentFiscalYear } from './MyTaxDeclarationPage';
import { payrollApi } from '../../services/payrollApi';

const mockApi = payrollApi as any;
const FY = currentFiscalYear();

const draftDeclaration = {
  id: 'd1', person_id: 'p1', fiscal_year: FY, regime: 'old', status: 'draft',
  items: [{ id: 'i1', category: '80C', description: 'PPF', declared_amount: 50000 }],
};

const renderPage = () => render(<MemoryRouter><MyTaxDeclarationPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GIVEN the fiscal-year helper', () => {
  it('WHEN the date is on/after April THEN the FY starts that year', () => {
    expect(currentFiscalYear(new Date(Date.UTC(2026, 3, 1)))).toBe('2026-27');
    expect(currentFiscalYear(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-27');
  });
  it('WHEN the date is before April THEN the FY started the previous year', () => {
    expect(currentFiscalYear(new Date(Date.UTC(2026, 0, 15)))).toBe('2025-26');
  });
  it('WHEN the FY crosses a century-style boundary THEN the suffix is zero-padded', () => {
    expect(currentFiscalYear(new Date(Date.UTC(2099, 5, 1)))).toBe('2099-00');
  });
});

describe('GIVEN an existing draft declaration', () => {
  beforeEach(() => {
    mockApi.my.taxDeclarations.get.mockResolvedValue(draftDeclaration);
  });

  it('WHEN the page loads THEN existing items render under their category with the regime selected', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('My Tax Declaration')).toBeInTheDocument());
    expect(mockApi.my.taxDeclarations.get).toHaveBeenCalledWith(FY);
    expect(screen.getByDisplayValue('PPF')).toBeInTheDocument();
    expect(screen.getByText(/Total declared/)).toBeInTheDocument();
    expect(screen.getByText('$50,000.00')).toBeInTheDocument();
  });

  it('WHEN an item is added under a category and edited THEN the total updates live', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Section 80D')).toBeInTheDocument());
    // Add under 80D (second category's Add button)
    fireEvent.click(screen.getAllByText('Add')[1]);
    const amountInputs = screen.getAllByLabelText('Section 80D declared amount');
    fireEvent.change(amountInputs[amountInputs.length - 1], { target: { value: '25000' } });
    await waitFor(() => expect(screen.getByText('$75,000.00')).toBeInTheDocument());
    // Description editing also flows through updateItem
    const desc = screen.getAllByPlaceholderText('Description (e.g. LIC premium)');
    fireEvent.change(desc[desc.length - 1], { target: { value: 'Health cover' } });
    expect(screen.getByDisplayValue('Health cover')).toBeInTheDocument();
  });

  it('WHEN an item is removed THEN it disappears and the total drops', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('PPF')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Remove item'));
    await waitFor(() => expect(screen.queryByDisplayValue('PPF')).not.toBeInTheDocument());
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('WHEN Save Draft is clicked THEN the declaration is saved with regime and items', async () => {
    mockApi.my.taxDeclarations.save.mockResolvedValue(draftDeclaration);
    renderPage();
    await waitFor(() => expect(screen.getByText('Save Draft')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Draft'));
    await waitFor(() =>
      expect(mockApi.my.taxDeclarations.save).toHaveBeenCalledWith(FY, {
        regime: 'old',
        items: draftDeclaration.items,
      }));
  });

  it('WHEN the regime is switched THEN the save carries the new regime', async () => {
    mockApi.my.taxDeclarations.save.mockResolvedValue(draftDeclaration);
    renderPage();
    await waitFor(() => expect(screen.getByText('New Regime')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Regime'));
    fireEvent.click(screen.getByText('Save Draft'));
    await waitFor(() =>
      expect(mockApi.my.taxDeclarations.save).toHaveBeenCalledWith(FY, expect.objectContaining({ regime: 'new' })));
  });

  it('WHEN Submit Declaration is confirmed THEN it saves first, then submits, then reloads', async () => {
    mockApi.my.taxDeclarations.save.mockResolvedValue(draftDeclaration);
    mockApi.my.taxDeclarations.submit.mockResolvedValue({ ...draftDeclaration, status: 'submitted' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Submit Declaration')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Submit Declaration'));
    await waitFor(() => expect(screen.getByText('Submit Tax Declaration')).toBeInTheDocument());
    expect(mockApi.my.taxDeclarations.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(mockApi.my.taxDeclarations.submit).toHaveBeenCalledWith(FY));
    expect(mockApi.my.taxDeclarations.save).toHaveBeenCalled();
    // load() runs again after submit
    expect(mockApi.my.taxDeclarations.get.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('WHEN the submit confirmation is cancelled THEN nothing is submitted', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Submit Declaration')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Submit Declaration'));
    await waitFor(() => expect(screen.getByText('Submit Tax Declaration')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Submit Tax Declaration')).not.toBeInTheDocument());
    // Reopen and close via the backdrop too
    fireEvent.click(screen.getByText('Submit Declaration'));
    await waitFor(() => expect(screen.getByText('Submit Tax Declaration')).toBeInTheDocument());
    fireEvent.click(document.querySelector('div.fixed.inset-0.bg-black\\/60') as Element);
    await waitFor(() => expect(screen.queryByText('Submit Tax Declaration')).not.toBeInTheDocument());
    expect(mockApi.my.taxDeclarations.submit).not.toHaveBeenCalled();
  });

  it('WHEN the save fails during submit THEN submit never fires and the dialog closes', async () => {
    mockApi.my.taxDeclarations.save.mockRejectedValue(new Error('bad'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Submit Declaration')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Submit Declaration'));
    await waitFor(() => expect(screen.getByText('Submit Tax Declaration')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(mockApi.my.taxDeclarations.save).toHaveBeenCalled());
    expect(mockApi.my.taxDeclarations.submit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Submit Tax Declaration')).not.toBeInTheDocument());
  });

  it('WHEN the submit call itself fails THEN the page stays editable', async () => {
    mockApi.my.taxDeclarations.save.mockResolvedValue(draftDeclaration);
    mockApi.my.taxDeclarations.submit.mockRejectedValue(new Error('bad'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Submit Declaration')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Submit Declaration'));
    await waitFor(() => expect(screen.getByText('Submit Tax Declaration')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(mockApi.my.taxDeclarations.submit).toHaveBeenCalled());
    expect(screen.getByText('Save Draft')).toBeInTheDocument();
  });
});

describe('GIVEN no declaration exists yet for this FY', () => {
  beforeEach(() => {
    mockApi.my.taxDeclarations.get.mockRejectedValue(new Error('404'));
  });

  it('WHEN the page loads THEN it starts fresh, editable, with Submit disabled until an item exists', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('My Tax Declaration')).toBeInTheDocument());
    expect(screen.getByText(/Nothing declared under Section 80C/)).toBeInTheDocument();
    expect(screen.getByText('Submit Declaration')).toBeDisabled();
    // Adding one item enables submission
    fireEvent.click(screen.getAllByText('Add')[0]);
    await waitFor(() => expect(screen.getByText('Submit Declaration')).not.toBeDisabled());
  });
});

describe('GIVEN a declaration that is no longer editable', () => {
  beforeEach(() => {
    mockApi.my.taxDeclarations.get.mockResolvedValue({
      ...draftDeclaration, status: 'under_review', review_notes: 'Missing rent receipts',
      items: [{ id: 'i1', category: '80C', declared_amount: 50000, status: 'pending' }],
    });
  });

  it('WHEN the page loads THEN editing controls are gone and the lock notice with reviewer notes shows', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Reviewer notes: Missing rent receipts/)).toBeInTheDocument());
    expect(screen.queryByText('Save Draft')).not.toBeInTheDocument();
    expect(screen.queryByText('Submit Declaration')).not.toBeInTheDocument();
    expect(screen.getByText(/can no longer be edited/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Remove item')).not.toBeInTheDocument();
    // Regime buttons are disabled
    expect(screen.getByText('New Regime')).toBeDisabled();
  });
});

describe('GIVEN an approved declaration', () => {
  it('WHEN the page loads THEN the whole timeline is marked done', async () => {
    mockApi.my.taxDeclarations.get.mockResolvedValue({ ...draftDeclaration, status: 'approved' });
    renderPage();
    await waitFor(() => expect(screen.getByText('approved')).toBeInTheDocument());
    expect(screen.getByText(/can no longer be edited/)).toBeInTheDocument();
  });
});
