import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../services/departmentsService', () => ({
  departmentsApi: {
    getAll: vi.fn(),
    getTree: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
}));

import DepartmentsPage from './DepartmentsPage';
import { departmentsApi } from '../services/departmentsService';

const mockApi = departmentsApi as any;

const renderPage = () => render(<MemoryRouter><DepartmentsPage /></MemoryRouter>);

const mockDept = { id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, employee_count: 5, children: [] };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given DepartmentsPage loads successfully', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockDept], total: 1 });
    mockApi.getTree.mockResolvedValue({ data: [mockDept] });
  });

  it('When page loads / Then "Departments" heading is visible', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Departments')).toBeInTheDocument());
  });

  it('When departments are fetched / Then department names are displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
  });

  it('When departments are fetched / Then department codes are displayed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ENG')).toBeInTheDocument());
  });
});

describe('Given DepartmentsPage with no departments', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [], total: 0 });
    mockApi.getTree.mockResolvedValue({ data: [] });
  });

  it('When there are no departments / Then empty state is shown', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No departments found/i)).toBeInTheDocument());
  });
});

describe('Given DepartmentsPage API failure', () => {
  beforeEach(() => {
    mockApi.getAll.mockRejectedValue(new Error('Server error'));
    mockApi.getTree.mockRejectedValue(new Error('Server error'));
  });

  it('When API fails / Then page renders without crashing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Departments')).toBeInTheDocument());
  });
});

describe('Given DepartmentsPage create interaction', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [mockDept], total: 1 });
    mockApi.getTree.mockResolvedValue({ data: [mockDept] });
  });

  it('When Add Department button is clicked / Then create modal opens', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Department'));
    await waitFor(() => expect(screen.getByText(/Code/i)).toBeInTheDocument());
  });
});
