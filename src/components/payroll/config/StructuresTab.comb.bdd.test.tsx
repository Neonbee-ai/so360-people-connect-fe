import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../../services/payrollApi', () => ({
  payrollApi: {
    structures: {
      list: vi.fn(), get: vi.fn(), create: vi.fn(),
      saveLines: vi.fn(), validate: vi.fn(), clone: vi.fn(), newVersion: vi.fn(),
    },
    components: { list: vi.fn() },
  },
}));

import StructuresTab from './StructuresTab';
import { payrollApi } from '../../../services/payrollApi';
import { toast } from '@so360/design-system';

const mockApi = payrollApi as any;
const basic = { id: 'c1', code: 'BASIC', name: 'Basic Salary', kind: 'earning', calc_type: 'fixed', calc_config: {}, frequency: 'per_period', taxable: true, is_statutory: false, prorate_on_lop: true, is_active: true };
const structure = {
  id: 's1', name: 'Standard India', code: 'STD_IN', status: 'active', version: 1,
  lines: [{ id: 'l1', structure_id: 's1', component_id: 'c1', component_code: 'BASIC', component_name: 'Basic Salary', kind: 'earning', calc_override: null, display_order: 1 }],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
  mockApi.structures.list.mockResolvedValue({ data: [structure], total: 1 });
  mockApi.structures.get.mockResolvedValue(structure);
  mockApi.components.list.mockResolvedValue({ data: [basic], total: 1 });
});

const openBuilder = async () => {
  render(<StructuresTab />);
  await waitFor(() => expect(screen.getByText('Standard India')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Open'));
  await waitFor(() => expect(screen.getByLabelText('Back to structures')).toBeInTheDocument());
};

describe('GIVEN the Comb structures tab', () => {
  it('WHEN it loads THEN the structure row and New Structure action render', async () => {
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('Standard India')).toBeInTheDocument());
    expect(screen.getByText('STD_IN')).toBeInTheDocument();
    expect(screen.getByText('New Structure')).toBeInTheDocument();
  });

  it('WHEN no structures exist THEN the empty state renders', async () => {
    mockApi.structures.list.mockResolvedValue({ data: [], total: 0 });
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('No salary structures')).toBeInTheDocument());
  });

  it('WHEN a structure is opened and Save Lines clicked THEN saveLines gets the lines', async () => {
    mockApi.structures.saveLines.mockResolvedValue(undefined);
    await openBuilder();
    fireEvent.click(screen.getByText('Save Lines'));
    await waitFor(() => expect(mockApi.structures.saveLines).toHaveBeenCalledWith('s1', expect.arrayContaining([expect.objectContaining({ component_id: 'c1' })])));
  });

  it('WHEN saving lines fails THEN the error message is toasted', async () => {
    mockApi.structures.saveLines.mockRejectedValue(new Error('Cycle'));
    await openBuilder();
    fireEvent.click(screen.getByText('Save Lines'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Cycle'));
  });
});
