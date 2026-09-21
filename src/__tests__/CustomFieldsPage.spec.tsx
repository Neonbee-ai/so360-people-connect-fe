import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/customFieldsService', () => ({
  customFieldDefsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  CHOICE_FIELD_TYPES: ['dropdown', 'multi_select'],
}));

let mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ ...mockShellFlags }),
}));

import CustomFieldsPage from '../pages/settings/CustomFieldsPage';
import { customFieldDefsApi } from '../services/customFieldsService';

const mockApi = customFieldDefsApi as any;

const renderPage = () => render(<MemoryRouter><CustomFieldsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
});

// ============================================================================
// Given custom field definitions exist
// ============================================================================
describe('Given CustomFieldsPage — existing definitions', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({
      data: [
        { id: 'f1', field_key: 'blood_group', label: 'Blood Group', field_type: 'text', options: null, is_required: false, is_active: true, sort_order: 0 },
        { id: 'f2', field_key: 'vehicle_type', label: 'Vehicle Type', field_type: 'dropdown', options: ['Car', 'Bike'], is_required: true, is_active: true, sort_order: 1 },
      ],
    });
  });

  it('When the page loads / Then it renders the definitions table with includeInactive requested', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Blood Group')).toBeInTheDocument());
    expect(mockApi.getAll).toHaveBeenCalledWith({ includeInactive: true });
    expect(screen.getByText('Vehicle Type')).toBeInTheDocument();
  });

  it('When the page loads / Then it shows the Required column value per row', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Blood Group')).toBeInTheDocument());
    const rows = screen.getAllByRole('row');
    const requiredCell = rows.find(r => r.textContent?.includes('Vehicle Type'));
    expect(requiredCell?.textContent).toContain('Yes');
  });
});

// ============================================================================
// Add a field def
// ============================================================================
describe('Given CustomFieldsPage — adding a field', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({ data: [] });
  });

  it('When Add Custom Field is clicked / Then the modal opens with default Text type and no options editor', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No custom fields')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Add Custom Field')[0]);
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. Blood Group')).toBeInTheDocument());
    expect(screen.queryByTestId('options-editor')).not.toBeInTheDocument();
  });

  it('Given field type is switched to Dropdown / When rendered / Then the options editor appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No custom fields')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Add Custom Field')[0]);
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. Blood Group')).toBeInTheDocument());

    const typeSelect = screen.getByDisplayValue('Text');
    fireEvent.change(typeSelect, { target: { value: 'dropdown' } });

    expect(await screen.findByTestId('options-editor')).toBeInTheDocument();
  });

  it('Given field type is switched to Multi Select / When rendered / Then the options editor appears', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No custom fields')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Add Custom Field')[0]);
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. Blood Group')).toBeInTheDocument());

    const typeSelect = screen.getByDisplayValue('Text');
    fireEvent.change(typeSelect, { target: { value: 'multi_select' } });

    expect(await screen.findByTestId('options-editor')).toBeInTheDocument();
  });

  it('When a dropdown field with options is submitted / Then customFieldDefsApi.create is called with the option list', async () => {
    mockApi.create.mockResolvedValue({ id: 'new-1', label: 'Vehicle Type' });
    renderPage();
    await waitFor(() => expect(screen.getByText('No custom fields')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Add Custom Field')[0]);

    fireEvent.change(await screen.findByPlaceholderText('e.g. Blood Group'), { target: { value: 'Vehicle Type' } });
    fireEvent.change(screen.getByDisplayValue('Text'), { target: { value: 'dropdown' } });

    const optionInput = await screen.findByPlaceholderText('Type an option and press Enter');
    fireEvent.change(optionInput, { target: { value: 'Car' } });
    fireEvent.click(screen.getByText('Add'));
    fireEvent.change(optionInput, { target: { value: 'Bike' } });
    fireEvent.click(screen.getByText('Add'));

    expect(screen.getByText('Car')).toBeInTheDocument();
    expect(screen.getByText('Bike')).toBeInTheDocument();

    const submitButtons1 = screen.getAllByRole('button', { name: 'Add Custom Field' });
    fireEvent.click(submitButtons1[submitButtons1.length - 1]);

    await waitFor(() =>
      expect(mockApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Vehicle Type', field_type: 'dropdown', options: ['Car', 'Bike'] }),
      ),
    );
  });

  it('When a text field is submitted / Then options is omitted from the create payload', async () => {
    mockApi.create.mockResolvedValue({ id: 'new-2', label: 'Blood Group' });
    renderPage();
    await waitFor(() => expect(screen.getByText('No custom fields')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Add Custom Field')[0]);

    fireEvent.change(await screen.findByPlaceholderText('e.g. Blood Group'), { target: { value: 'Blood Group' } });
    const submitButtons2 = screen.getAllByRole('button', { name: 'Add Custom Field' });
    fireEvent.click(submitButtons2[submitButtons2.length - 1]);

    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
    const payload = mockApi.create.mock.calls[0][0];
    expect(payload.options).toBeUndefined();
  });
});

// ============================================================================
// Edit / deactivate a field def
// ============================================================================
describe('Given CustomFieldsPage — editing and deactivating', () => {
  beforeEach(() => {
    mockApi.getAll.mockResolvedValue({
      data: [
        { id: 'f1', field_key: 'blood_group', label: 'Blood Group', field_type: 'text', options: null, is_required: false, is_active: true, sort_order: 0 },
      ],
    });
  });

  it('When Edit is clicked / Then the modal opens pre-filled, field type select is disabled', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Blood Group')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Edit'));
    await waitFor(() => expect(screen.getByDisplayValue('Blood Group')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Text')).toBeDisabled();
  });

  it('When the label is changed and saved / Then customFieldDefsApi.update is called with the new label', async () => {
    mockApi.update.mockResolvedValue({ id: 'f1', label: 'Blood Type' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Blood Group')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Edit'));

    const labelInput = await screen.findByDisplayValue('Blood Group');
    fireEvent.change(labelInput, { target: { value: 'Blood Type' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(mockApi.update).toHaveBeenCalledWith('f1', expect.objectContaining({ label: 'Blood Type' })),
    );
  });

  it('When the Active toggle is clicked / Then customFieldDefsApi.update flips is_active to false', async () => {
    mockApi.update.mockResolvedValue({ id: 'f1', is_active: false });
    renderPage();
    await waitFor(() => expect(screen.getByText('Blood Group')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Deactivate'));

    await waitFor(() =>
      expect(mockApi.update).toHaveBeenCalledWith('f1', { is_active: false }),
    );
  });

  it('When Delete is clicked / Then customFieldDefsApi.delete is called with the id', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Custom field deleted' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Blood Group')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('f1'));
  });
});

// ============================================================================
// Failure / empty states
// ============================================================================
describe('Given CustomFieldsPage — failure and empty states', () => {
  it('Given the fetch fails / When the page loads / Then an error state is shown', async () => {
    mockApi.getAll.mockRejectedValue(new Error('network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Couldn't load custom fields/i)).toBeInTheDocument());
  });

  it('Given no fields exist / When the page loads / Then the empty state is shown with an Add action', async () => {
    mockApi.getAll.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No custom fields')).toBeInTheDocument());
    expect(screen.getAllByText('Add Custom Field').length).toBeGreaterThan(0);
  });
});
