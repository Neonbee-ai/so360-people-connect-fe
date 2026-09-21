import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    export: vi.fn(),
    import: vi.fn(),
    validateImport: vi.fn(),
    getImportTemplate: vi.fn(),
  },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getAll: vi.fn() },
  Department: {},
}));

import ImportExportPage from './ImportExportPage';
import { peopleApi } from '../services/peopleService';
import { departmentsApi } from '../services/departmentsService';

const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><ImportExportPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  (departmentsApi as any).getAll.mockResolvedValue({ data: [] });
  (peopleApi as any).getImportTemplate.mockResolvedValue(new Blob(['a,b']));
});

describe('Given the People Registry Import button navigates with ?tab=import', () => {
  it('When the page opens / Then the Import workflow is shown, not Export', async () => {
    renderAt('/people/import-export?tab=import');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Import People' })).toBeInTheDocument());
    expect(screen.getByText('Click to browse or drag and drop')).toBeInTheDocument();
  });

  it('When the Import workflow is shown / Then no export controls are present', async () => {
    renderAt('/people/import-export?tab=import');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Import People' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /export people/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Format')).not.toBeInTheDocument();
  });

  it('When the Import workflow is shown / Then the template download stays available', async () => {
    renderAt('/people/import-export?tab=import');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Import People' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /download template/i }));
    await waitFor(() => expect((peopleApi as any).getImportTemplate).toHaveBeenCalled());
  });

  it('When the Import workflow is shown / Then the Validate action is rendered alongside the upload area', async () => {
    renderAt('/people/import-export?tab=import');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Validate' })).toBeInTheDocument());
    expect(screen.getByText("Validate Only (Don't import yet)")).toBeInTheDocument();
  });
});

describe('Given the page is opened without a tab parameter', () => {
  it('When the page opens / Then the Export workflow is shown by default', async () => {
    renderAt('/people/import-export');

    await waitFor(() => expect(screen.getByRole('button', { name: /export people/i })).toBeInTheDocument());
    expect(screen.queryByText('Click to browse or drag and drop')).not.toBeInTheDocument();
  });

  it('When the Export workflow is shown / Then no import controls are present', async () => {
    renderAt('/people/import-export');

    await waitFor(() => expect(screen.getByRole('button', { name: /export people/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Validate' })).not.toBeInTheDocument();
  });
});

describe('Given the workflow tabs', () => {
  it('When the Import tab is selected / Then it becomes the active tab and Export disappears', async () => {
    renderAt('/people/import-export');
    await waitFor(() => expect(screen.getByRole('button', { name: /export people/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Import People' }));

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Import People' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.queryByRole('button', { name: /export people/i })).not.toBeInTheDocument();
  });
});
