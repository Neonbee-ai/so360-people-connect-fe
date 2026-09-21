import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../services/departmentsService', () => ({
  departmentsApi: {
    getTree: vi.fn(),
  },
  Department: {},
}));

import DepartmentSelector from '../components/DepartmentSelector';
import { departmentsApi } from '../services/departmentsService';

const mockApi = departmentsApi as any;

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.getTree.mockResolvedValue({
    data: [
      {
        id: 'd1', name: 'Engineering', code: 'ENG', is_active: true,
        children: [
          { id: 'd2', name: 'Frontend', code: 'FE', is_active: true, children: [] },
        ],
      },
      { id: 'd3', name: 'Marketing', code: 'MKT', is_active: true, children: [] },
    ],
  });
});

describe('DepartmentSelector', () => {
  describe('Given departments are loaded', () => {
    it('When the dropdown is opened / Then it shows all departments', async () => {
      render(<DepartmentSelector value="" onChange={() => {}} />);
      await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select department...'));
      await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('When a department is selected / Then onChange is called', async () => {
      const onChange = vi.fn();
      render(<DepartmentSelector value="" onChange={onChange} />);
      await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select department...'));
      await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Engineering'));
      expect(onChange).toHaveBeenCalledWith('d1');
    });

    it('When a value is set / Then the selected department name is shown', async () => {
      render(<DepartmentSelector value="d1" onChange={() => {}} />);
      await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    });

    it('When searching / Then the list is filtered by name', async () => {
      render(<DepartmentSelector value="" onChange={() => {}} />);
      await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select department...'));
      await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('Select department...'), { target: { value: 'market' } });
      expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('When searching by code / Then the list is filtered by code', async () => {
      render(<DepartmentSelector value="" onChange={() => {}} />);
      await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select department...'));
      await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('Select department...'), { target: { value: 'FE' } });
      expect(screen.getByText('Frontend')).toBeInTheDocument();
    });

    it('When allowClear is true and value is set / Then clear button clears value', async () => {
      const onChange = vi.fn();
      render(<DepartmentSelector value="d1" onChange={onChange} allowClear />);
      await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
      fireEvent.click(screen.getByText('×'));
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('When departments have codes / Then codes are displayed', async () => {
      render(<DepartmentSelector value="" onChange={() => {}} />);
      await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select department...'));
      await waitFor(() => expect(screen.getByText('ENG')).toBeInTheDocument());
      expect(screen.getByText('MKT')).toBeInTheDocument();
    });
  });

  describe('Given the API fails', () => {
    it('When getTree rejects / Then the list shows no departments', async () => {
      mockApi.getTree.mockImplementation(async () => { throw new Error('fail'); });
      render(<DepartmentSelector value="" onChange={() => {}} />);
      await waitFor(() => expect(mockApi.getTree).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select department...'));
      await waitFor(() => expect(screen.getByText('No departments found')).toBeInTheDocument());
    });
  });
});
