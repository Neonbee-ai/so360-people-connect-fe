import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../../services/payrollApi', () => ({
  payrollApi: {
    template: { get: vi.fn(), update: vi.fn(), preview: vi.fn() },
  },
}));

import PayslipTemplateTab from './PayslipTemplateTab';
import { payrollApi } from '../../../services/payrollApi';
import { toast } from '@so360/design-system';

const mockApi = payrollApi as any;
const template = { id: 't1', layout: 'light', table_style: 'boxed', font: 'inter', primary_color: '#0f766e', secondary_color: '#334155', logo_url: '', address: '', tagline: '', footer_text: '', paper_format: 'A4' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
  mockApi.template.get.mockResolvedValue({ ...template });
  mockApi.template.preview.mockResolvedValue({ html: '<div>Sample payslip HTML</div>' });
});

describe('GIVEN the Comb payslip template tab', () => {
  it('WHEN it loads THEN the layout radio group and Save Template action render', async () => {
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByRole('radiogroup', { name: 'Payslip layout' })).toBeInTheDocument());
    expect(screen.getByText('Save Template')).toBeInTheDocument();
  });

  it('WHEN the template is not available THEN the empty state renders', async () => {
    mockApi.template.get.mockResolvedValue(null);
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByText('Payslip template is not available yet.')).toBeInTheDocument());
  });

  it('WHEN Save Template is clicked THEN template.update receives the current layout', async () => {
    mockApi.template.update.mockResolvedValue({ ...template });
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByText('Save Template')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Template'));
    await waitFor(() => expect(mockApi.template.update).toHaveBeenCalledWith(expect.objectContaining({ layout: 'light', paper_format: 'A4' })));
  });

  it('WHEN saving fails THEN an error toast is shown', async () => {
    mockApi.template.update.mockRejectedValue(new Error('nope'));
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByText('Save Template')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Template'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save payslip template'));
  });
});
