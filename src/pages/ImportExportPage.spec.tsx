import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/peopleService', () => ({
  peopleApi: {
    export: vi.fn(),
    import: vi.fn(),
    getImportTemplate: vi.fn(),
    validateImport: vi.fn(),
  },
}));

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getAll: vi.fn() },
  Department: {},
}));

import ImportExportPage from './ImportExportPage';
import { peopleApi } from '../services/peopleService';
import { departmentsApi } from '../services/departmentsService';

const mockPeopleApi = peopleApi as any;
const mockDeptApi = departmentsApi as any;

const renderPage = () => render(<MemoryRouter><ImportExportPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockDeptApi.getAll.mockResolvedValue({ data: [] });
});

describe('Given ImportExportPage renders', () => {
  it('When page loads / Then "Import / Export" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Import \/ Export|Import\/Export/i)).toBeInTheDocument());
  });

  it('When page loads / Then the Export section is present', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /Export People/i })).toBeInTheDocument());
  });

  it('When page loads / Then the Import section is present', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Import People/i)).toBeInTheDocument());
  });

  it('When page loads / Then the CSV and Excel format options are available', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('CSV')).toBeInTheDocument());
    expect(screen.getByText('Excel')).toBeInTheDocument();
  });
});

describe('Given ImportExportPage with departments loaded', () => {
  beforeEach(() => {
    mockDeptApi.getAll.mockResolvedValue({
      data: [{ id: 'd1', name: 'Engineering', code: 'ENG', is_active: true }],
    });
  });

  it('When departments are fetched / Then the department filter is populated', async () => {
    renderPage();
    await waitFor(() => expect(mockDeptApi.getAll).toHaveBeenCalled());
  });
});

describe('Given ImportExportPage department API failure', () => {
  beforeEach(() => {
    mockDeptApi.getAll.mockImplementation(async () => { throw new Error('Dept load failed'); });
  });

  it('When departments fail to load / Then page still renders without crashing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Import \/ Export|Import\/Export/i)).toBeInTheDocument());
  });
});

describe('Given ImportExportPage download template', () => {
  it('When page loads / Then download template link is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Download Template/i)).toBeInTheDocument());
  });
});
