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

const mockApi = payrollApi as any;

const basic = { id: 'c1', code: 'BASIC', name: 'Basic Salary', kind: 'earning', calc_type: 'fixed', calc_config: {}, frequency: 'per_period', taxable: true, is_statutory: false, prorate_on_lop: true, is_active: true };
const hra = { id: 'c2', code: 'HRA', name: 'House Rent Allowance', kind: 'earning', calc_type: 'percent_of', calc_config: { percent: 40, of: 'BASIC' }, frequency: 'per_period', taxable: true, is_statutory: false, prorate_on_lop: true, is_active: true };
const ta = { id: 'c3', code: 'TA', name: 'Travel Allowance', kind: 'earning', calc_type: 'fixed', calc_config: { amount: 1200 }, frequency: 'per_period', taxable: true, is_statutory: false, prorate_on_lop: false, is_active: true };

const structure = {
  id: 's1', name: 'Standard India', code: 'STD_IN', status: 'active', version: 1,
  lines: [
    { id: 'l1', structure_id: 's1', component_id: 'c1', component_code: 'BASIC', component_name: 'Basic Salary', kind: 'earning', calc_override: null, display_order: 1 },
    { id: 'l2', structure_id: 's1', component_id: 'c2', component_code: 'HRA', component_name: 'House Rent Allowance', kind: 'earning', calc_override: { amount: 8000 }, display_order: 2 },
  ],
};

const openBuilder = async () => {
  render(<StructuresTab />);
  await waitFor(() => expect(screen.getByText('Standard India')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Open'));
  await waitFor(() => expect(screen.getByLabelText('Back to structures')).toBeInTheDocument());
};

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.structures.list.mockResolvedValue({ data: [structure], total: 1 });
  mockApi.structures.get.mockResolvedValue(structure);
  mockApi.components.list.mockResolvedValue({ data: [basic, hra, ta], total: 3 });
});

describe('GIVEN the structures list', () => {
  it('WHEN it loads THEN each structure shows name, code, version and status', async () => {
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('Standard India')).toBeInTheDocument());
    expect(screen.getByText('STD_IN')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('WHEN no structures exist THEN the empty state offers creating one', async () => {
    mockApi.structures.list.mockResolvedValue({ data: [], total: 0 });
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('No salary structures')).toBeInTheDocument());
  });

  it('WHEN the list API fails THEN the tab falls back to the empty state', async () => {
    mockApi.structures.list.mockRejectedValue(new Error('down'));
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('No salary structures')).toBeInTheDocument());
  });

  it('WHEN a new structure is created THEN structures.create receives the form and the builder opens', async () => {
    mockApi.structures.create.mockResolvedValue({ ...structure, id: 's2', name: 'Contractor', code: 'CONTRACT', lines: [] });
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('New Structure')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Structure'));
    await waitFor(() => expect(screen.getByText('New Salary Structure')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Standard India — Monthly'), { target: { value: 'Contractor' } });
    fireEvent.change(screen.getByPlaceholderText('STD_IN_MONTHLY'), { target: { value: 'contract' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.structures.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Contractor', code: 'CONTRACT',
    })));
    await waitFor(() => expect(screen.getByLabelText('Back to structures')).toBeInTheDocument());
  });

  it('WHEN the create form misses a code THEN nothing is submitted', async () => {
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('New Structure')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Structure'));
    await waitFor(() => expect(screen.getByText('New Salary Structure')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Standard India — Monthly'), { target: { value: 'Only name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(mockApi.structures.create).not.toHaveBeenCalled();
  });

  it('WHEN the create modal is cancelled THEN it closes without creating', async () => {
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('New Structure')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Structure'));
    await waitFor(() => expect(screen.getByText('New Salary Structure')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('New Salary Structure')).not.toBeInTheDocument());
    // Reopen and dismiss via the backdrop (Modal onClose path)
    fireEvent.click(screen.getByText('New Structure'));
    await waitFor(() => expect(screen.getByText('New Salary Structure')).toBeInTheDocument());
    fireEvent.click(document.querySelector('div.fixed.inset-0.bg-black\\/60') as Element);
    await waitFor(() => expect(screen.queryByText('New Salary Structure')).not.toBeInTheDocument());
    expect(mockApi.structures.create).not.toHaveBeenCalled();
  });

  it('WHEN creating fails THEN the modal stays open', async () => {
    mockApi.structures.create.mockRejectedValue(new Error('dup'));
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('New Structure')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Structure'));
    await waitFor(() => expect(screen.getByText('New Salary Structure')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Standard India — Monthly'), { target: { value: 'X' } });
    fireEvent.change(screen.getByPlaceholderText('STD_IN_MONTHLY'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockApi.structures.create).toHaveBeenCalled());
    expect(screen.getByText('New Salary Structure')).toBeInTheDocument();
  });

  it('WHEN opening a structure detail fails THEN the list stays visible', async () => {
    mockApi.structures.get.mockRejectedValue(new Error('nope'));
    render(<StructuresTab />);
    await waitFor(() => expect(screen.getByText('Standard India')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => expect(mockApi.structures.get).toHaveBeenCalled());
    expect(screen.queryByLabelText('Back to structures')).not.toBeInTheDocument();
  });
});

describe('GIVEN the structure builder', () => {
  it('WHEN it opens THEN existing lines render in order with overrides', async () => {
    await openBuilder();
    expect(screen.getByText('BASIC')).toBeInTheDocument();
    expect(screen.getByText('HRA')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8000')).toBeInTheDocument();
  });

  it('WHEN the back button is used THEN the list reloads', async () => {
    await openBuilder();
    fireEvent.click(screen.getByLabelText('Back to structures'));
    await waitFor(() => expect(screen.getByText('Open')).toBeInTheDocument());
    expect(mockApi.structures.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('WHEN a duplicate component is added THEN it is refused', async () => {
    await openBuilder();
    await waitFor(() => expect(screen.getByText('BASIC — Basic Salary')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Add component'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    // Still exactly one BASIC row
    expect(screen.getAllByText('BASIC')).toHaveLength(1);
  });

  it('WHEN a fresh component is picked and added THEN it appends as the last line and is saved', async () => {
    mockApi.structures.saveLines.mockResolvedValue(structure);
    await openBuilder();
    // Wait for the component options to load before picking one
    await waitFor(() => expect(screen.getByText('TA — Travel Allowance')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Add component'), { target: { value: 'c3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByText('TA')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Lines'));
    await waitFor(() => expect(mockApi.structures.saveLines).toHaveBeenCalled());
    const [, lines] = mockApi.structures.saveLines.mock.calls[0];
    expect(lines[2]).toMatchObject({ component_id: 'c3', component_code: 'TA', display_order: 3, calc_override: null });
  });

  it('WHEN Add is clicked with no component chosen THEN nothing changes', async () => {
    await openBuilder();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByText('BASIC')).toHaveLength(1);
  });

  it('WHEN lines are reordered and saved THEN saveLines receives the new display order', async () => {
    mockApi.structures.saveLines.mockResolvedValue(structure);
    await openBuilder();
    // Move BASIC (row 1) down
    fireEvent.click(screen.getAllByLabelText('Move down')[0]);
    fireEvent.click(screen.getByText('Save Lines'));
    await waitFor(() => expect(mockApi.structures.saveLines).toHaveBeenCalled());
    const [, lines] = mockApi.structures.saveLines.mock.calls[0];
    expect(lines.map((l: any) => l.component_code)).toEqual(['HRA', 'BASIC']);
    expect(lines.map((l: any) => l.display_order)).toEqual([1, 2]);
  });

  it('WHEN a move would go out of bounds THEN the order is unchanged', async () => {
    mockApi.structures.saveLines.mockResolvedValue(structure);
    await openBuilder();
    fireEvent.click(screen.getAllByLabelText('Move up')[0]); // BASIC is already first
    fireEvent.click(screen.getByText('Save Lines'));
    await waitFor(() => expect(mockApi.structures.saveLines).toHaveBeenCalled());
    const [, lines] = mockApi.structures.saveLines.mock.calls[0];
    expect(lines.map((l: any) => l.component_code)).toEqual(['BASIC', 'HRA']);
  });

  it('WHEN a line is removed THEN the remaining lines renumber', async () => {
    mockApi.structures.saveLines.mockResolvedValue(structure);
    await openBuilder();
    fireEvent.click(screen.getAllByLabelText('Remove line')[0]);
    await waitFor(() => expect(screen.queryByText('BASIC')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Lines'));
    await waitFor(() => expect(mockApi.structures.saveLines).toHaveBeenCalled());
    const [, lines] = mockApi.structures.saveLines.mock.calls[0];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ component_code: 'HRA', display_order: 1 });
  });

  it('WHEN every line is removed THEN the builder shows the no-components hint', async () => {
    await openBuilder();
    fireEvent.click(screen.getAllByLabelText('Remove line')[0]);
    fireEvent.click(screen.getAllByLabelText('Remove line')[0]);
    await waitFor(() => expect(screen.getByText(/No components yet/)).toBeInTheDocument());
  });

  it('WHEN a new component is added with an override typed and cleared THEN calc_override toggles', async () => {
    mockApi.structures.saveLines.mockResolvedValue(structure);
    await openBuilder();
    const overrideInput = screen.getByLabelText('Override amount for BASIC');
    fireEvent.change(overrideInput, { target: { value: '30000' } });
    fireEvent.change(screen.getByLabelText('Override amount for HRA'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save Lines'));
    await waitFor(() => expect(mockApi.structures.saveLines).toHaveBeenCalled());
    const [, lines] = mockApi.structures.saveLines.mock.calls[0];
    expect(lines[0].calc_override).toEqual({ amount: 30000 });
    expect(lines[1].calc_override).toBeNull();
  });

  it('WHEN saving lines fails THEN the builder stays usable', async () => {
    mockApi.structures.saveLines.mockRejectedValue(new Error('conflict'));
    await openBuilder();
    fireEvent.click(screen.getByText('Save Lines'));
    await waitFor(() => expect(mockApi.structures.saveLines).toHaveBeenCalled());
    expect(screen.getByText('Save Lines')).toBeInTheDocument();
  });

  it('WHEN components fail to load THEN the builder still renders its lines', async () => {
    mockApi.components.list.mockRejectedValue(new Error('down'));
    await openBuilder();
    expect(screen.getByText('BASIC')).toBeInTheDocument();
  });
});

describe('GIVEN structure validation', () => {
  it('WHEN Validate succeeds THEN order and preview amounts render', async () => {
    mockApi.structures.saveLines.mockResolvedValue(structure);
    mockApi.structures.validate.mockResolvedValue({
      valid: true,
      errors: [],
      order: ['BASIC', 'HRA'],
      preview: [
        { component_code: 'BASIC', kind: 'earning', amount: 30000 },
        { component_code: 'HRA', kind: 'earning' },
      ],
    });
    await openBuilder();
    fireEvent.change(screen.getByDisplayValue('50000'), { target: { value: '60000' } });
    fireEvent.click(screen.getByText('Validate'));
    await waitFor(() => expect(screen.getByText('Valid structure')).toBeInTheDocument());
    expect(mockApi.structures.validate).toHaveBeenCalledWith('s1', { monthly_wage: 60000 });
    expect(screen.getByText('BASIC → HRA')).toBeInTheDocument();
    expect(screen.getByText('$30,000.00')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // preview row with no amount
  });

  it('WHEN validation finds errors THEN each error renders in the failure panel', async () => {
    mockApi.structures.saveLines.mockResolvedValue(structure);
    mockApi.structures.validate.mockResolvedValue({
      valid: false,
      errors: ['Circular dependency: HRA → BASIC → HRA', 'Unknown code TA'],
    });
    await openBuilder();
    fireEvent.click(screen.getByText('Validate'));
    await waitFor(() => expect(screen.getByText('Validation failed')).toBeInTheDocument());
    expect(screen.getByText('Circular dependency: HRA → BASIC → HRA')).toBeInTheDocument();
    expect(screen.getByText('Unknown code TA')).toBeInTheDocument();
  });

  it('WHEN the validate call fails THEN no result panel renders', async () => {
    mockApi.structures.saveLines.mockResolvedValue(structure);
    mockApi.structures.validate.mockRejectedValue(new Error('500'));
    await openBuilder();
    fireEvent.click(screen.getByText('Validate'));
    await waitFor(() => expect(mockApi.structures.validate).toHaveBeenCalled());
    expect(screen.queryByText('Valid structure')).not.toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
  });
});

describe('GIVEN clone and versioning', () => {
  it('WHEN Clone is clicked THEN the cloned structure opens in the builder', async () => {
    const cloned = { ...structure, id: 's-copy', name: 'Standard India (Copy)', lines: [] };
    mockApi.structures.clone.mockResolvedValue(cloned);
    mockApi.structures.get.mockResolvedValueOnce(structure).mockResolvedValueOnce(cloned);
    await openBuilder();
    fireEvent.click(screen.getByText('Clone'));
    await waitFor(() => expect(mockApi.structures.clone).toHaveBeenCalledWith('s1'));
    // onReload re-fetches the clone's detail
    await waitFor(() => expect(mockApi.structures.get).toHaveBeenLastCalledWith('s-copy'));
  });

  it('WHEN cloning fails THEN the builder stays on the current structure', async () => {
    mockApi.structures.clone.mockRejectedValue(new Error('nope'));
    await openBuilder();
    fireEvent.click(screen.getByText('Clone'));
    await waitFor(() => expect(mockApi.structures.clone).toHaveBeenCalled());
    expect(screen.getByText('Standard India')).toBeInTheDocument();
  });

  it('WHEN New Version is clicked THEN the new version opens in the builder', async () => {
    const v2 = { ...structure, id: 's1-v2', version: 2 };
    mockApi.structures.newVersion.mockResolvedValue(v2);
    await openBuilder();
    fireEvent.click(screen.getByText('New Version'));
    await waitFor(() => expect(mockApi.structures.newVersion).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(mockApi.structures.get).toHaveBeenLastCalledWith('s1-v2'));
  });

  it('WHEN creating a new version fails THEN the builder stays put', async () => {
    mockApi.structures.newVersion.mockRejectedValue(new Error('nope'));
    await openBuilder();
    fireEvent.click(screen.getByText('New Version'));
    await waitFor(() => expect(mockApi.structures.newVersion).toHaveBeenCalled());
    expect(screen.getByText('Standard India')).toBeInTheDocument();
  });
});
