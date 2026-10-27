import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

describe('GIVEN the Comb My Tax Declaration page', () => {
  beforeEach(() => {
    mockApi.my.taxDeclarations.get.mockResolvedValue(draftDeclaration);
  });

  it('WHEN a draft loads THEN the title, fiscal year and items render', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('My Tax Declaration')).toBeInTheDocument());
    expect(screen.getByText(`Fiscal year ${FY}`)).toBeInTheDocument();
    expect(screen.getByDisplayValue('PPF')).toBeInTheDocument();
  });

  it('WHEN editable THEN Save Draft and Submit Declaration actions show', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Save Draft')).toBeInTheDocument());
    expect(screen.getByText('Submit Declaration')).toBeInTheDocument();
  });

  it('WHEN Submit Declaration is clicked THEN a confirm modal opens and submits', async () => {
    mockApi.my.taxDeclarations.save.mockResolvedValue(draftDeclaration);
    mockApi.my.taxDeclarations.submit.mockResolvedValue({ ...draftDeclaration, status: 'submitted' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Submit Declaration')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Submit Declaration'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(within(screen.getByRole('dialog')).getByText('Cancel')).toBeInTheDocument();
  });

  it('WHEN the declaration is submitted THEN the editing actions are hidden', async () => {
    mockApi.my.taxDeclarations.get.mockResolvedValue({ ...draftDeclaration, status: 'submitted' });
    renderPage();
    await waitFor(() => expect(screen.getByText('My Tax Declaration')).toBeInTheDocument());
    expect(screen.queryByText('Save Draft')).not.toBeInTheDocument();
  });
});
