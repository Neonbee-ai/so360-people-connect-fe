import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/peopleService', () => ({
  peopleApi: { export: vi.fn(), getImportTemplate: vi.fn(), import: vi.fn(), validateImport: vi.fn() },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getAll: vi.fn() },
  Department: {},
}));

import ImportExportPage from '../pages/ImportExportPage';
import { peopleApi } from '../services/peopleService';
import { departmentsApi } from '../services/departmentsService';

const mockPeople = peopleApi as any;
const mockDepts = departmentsApi as any;

const renderPage = () => render(<MemoryRouter><ImportExportPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockDepts.getAll.mockResolvedValue({ data: [{ id: 'd1', name: 'Engineering' }] });
});

describe('ImportExportPage', () => {
  describe('Given the page loads', () => {
    it('When rendered / Then it shows export and import sections', async () => {
      renderPage();
      expect(screen.getAllByText('Export People').length).toBeGreaterThan(0);
      expect(screen.getByText('Import People')).toBeInTheDocument();
    });

    it('When rendered / Then it loads departments for filter', async () => {
      renderPage();
      await waitFor(() => expect(mockDepts.getAll).toHaveBeenCalledWith({ is_active: true }));
    });
  });

  describe('Given the export button is clicked', () => {
    it('When export succeeds / Then it creates a download', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/csv' });
      mockPeople.export.mockResolvedValue(mockBlob);
      const createObjectURL = vi.fn().mockReturnValue('blob:test');
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

      renderPage();
      const buttons = screen.getAllByText('Export People');
      const exportBtn = buttons.find(el => el.closest('button'));
      fireEvent.click(exportBtn!);
      await waitFor(() => expect(mockPeople.export).toHaveBeenCalled());
    });
  });

  describe('Given validation is run', () => {
    it('When validation has errors / Then it shows the error count', async () => {
      mockPeople.validateImport.mockResolvedValue({
        valid: false,
        errors: [{ row: 2, field: 'email', message: 'Invalid email' }],
      });

      renderPage();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(screen.getByText('Validate'));
      await waitFor(() => expect(screen.getByText(/1 errors found/)).toBeInTheDocument());
    });
  });
});
