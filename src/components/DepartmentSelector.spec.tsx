import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn() },
  Department: {},
}));

import DepartmentSelector from './DepartmentSelector';
import { departmentsApi } from '../services/departmentsService';

const mockApi = departmentsApi as any;

const mockDepts = [
  { id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, children: [
    { id: 'd2', name: 'Frontend', code: 'FE', is_active: true, children: [] },
  ]},
  { id: 'd3', name: 'Marketing', code: 'MKT', is_active: true, children: [] },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.getTree.mockResolvedValue({ data: mockDepts });
});

describe('Given DepartmentSelector with departments loaded', () => {
  it('When rendered without value / Then placeholder is shown', async () => {
    render(<DepartmentSelector value="" onChange={() => {}} placeholder="Pick a dept" />);
    await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
    expect(screen.getByText('Pick a dept')).toBeInTheDocument();
  });

  it('When opened / Then all top-level departments are shown', async () => {
    render(<DepartmentSelector value="" onChange={() => {}} />);
    await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select department...'));
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('When a department is selected / Then onChange is called with its id', async () => {
    const onChange = vi.fn();
    render(<DepartmentSelector value="" onChange={onChange} />);
    await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select department...'));
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Engineering'));
    expect(onChange).toHaveBeenCalledWith('d1');
  });

  it('When value is set / Then the selected department name is displayed', async () => {
    render(<DepartmentSelector value="d1" onChange={() => {}} />);
    await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
  });

  it('When allowClear is true and value is set / Then clear button clears the selection', async () => {
    const onChange = vi.fn();
    render(<DepartmentSelector value="d1" onChange={onChange} allowClear />);
    await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('Given DepartmentSelector with search', () => {
  it('When searching by name / Then list is filtered', async () => {
    render(<DepartmentSelector value="" onChange={() => {}} />);
    await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select department...'));
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Select department...'), { target: { value: 'market' } });
    expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });
});

describe('Given DepartmentSelector API failure', () => {
  it('When getTree fails / Then no departments are shown', async () => {
    mockApi.getTree.mockRejectedValue(new Error('Network error'));
    render(<DepartmentSelector value="" onChange={() => {}} />);
    await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select department...'));
    await waitFor(() => expect(screen.getByText('No departments found')).toBeInTheDocument());
  });
});
