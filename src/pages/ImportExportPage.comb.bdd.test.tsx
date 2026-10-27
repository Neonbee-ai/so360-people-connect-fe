import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@so360/design-system';

vi.mock('../services/peopleService', () => ({
  peopleApi: { export: vi.fn(), import: vi.fn(), validateImport: vi.fn(), getImportTemplate: vi.fn() },
}));
vi.mock('../services/departmentsService', () => ({ departmentsApi: { getAll: vi.fn() } }));

import ImportExportPage from './ImportExportPage';
import { peopleApi } from '../services/peopleService';
import { departmentsApi } from '../services/departmentsService';

const people = peopleApi as any;
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><ImportExportPage /></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
  Object.values(people).forEach((f: any) => f.mockReset());
  (departmentsApi as any).getAll.mockReset().mockResolvedValue({ data: [{ id: 'd1', name: 'Engineering' }] });
  (window.URL as any).createObjectURL = vi.fn(() => 'blob:x');
  (window.URL as any).revokeObjectURL = vi.fn();
});

describe('ImportExportPage (Comb)', () => {
  it('Given the default route / When rendered / Then title and export workflow show', async () => {
    renderAt('/people/import-export');
    expect(screen.getByText('Data Management')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Export People' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
  });

  it('Given the export form / When Export People is clicked / Then export is called with filters', async () => {
    people.export.mockResolvedValue(new Blob(['a']));
    const ok = vi.spyOn(toast, 'success');
    renderAt('/people/import-export');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export People' }));
    await waitFor(() => expect(people.export).toHaveBeenCalledWith('csv', { status: 'active' }));
    expect(ok).toHaveBeenCalledWith('Exported successfully as CSV');
  });

  it('Given the export fails / When clicked / Then an error toast is shown', async () => {
    people.export.mockRejectedValue(new Error('boom'));
    const err = vi.spyOn(toast, 'error');
    renderAt('/people/import-export');
    fireEvent.click(screen.getByRole('button', { name: 'Export People' }));
    await waitFor(() => expect(err).toHaveBeenCalledWith('boom'));
  });

  it('Given ?tab=import / When rendered / Then Validate is disabled until a file is chosen', () => {
    renderAt('/people/import-export?tab=import');
    expect(screen.getByRole('heading', { name: 'Import People' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validate' })).toBeDisabled();
  });

  it('Given a chosen file / When validated / Then validateImport is called and errors are listed', async () => {
    people.validateImport.mockResolvedValue({ errors: [{ row: 2, field: 'email', message: 'bad' }] });
    renderAt('/people/import-export?tab=import');
    const file = new File(['x'], 'p.csv', { type: 'text/csv' });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await waitFor(() => expect(people.validateImport).toHaveBeenCalledWith(file));
    expect(await screen.findByText(/1 errors found/)).toBeInTheDocument();
    expect(screen.getByText('bad')).toBeInTheDocument();
  });
});
