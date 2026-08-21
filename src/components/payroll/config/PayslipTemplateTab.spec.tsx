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

const template = {
  id: 't1', layout: 'light', table_style: 'boxed', font: 'inter',
  primary_color: '#0f766e', secondary_color: '#334155',
  logo_url: '', address: '', tagline: '', footer_text: '', paper_format: 'A4',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.template.get.mockResolvedValue({ ...template });
  mockApi.template.preview.mockResolvedValue({ html: '<div>Sample payslip HTML</div>' });
});

describe('GIVEN the payslip template tab', () => {
  it('WHEN it loads THEN layout and table-style pickers reflect the stored template', async () => {
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByRole('radiogroup', { name: 'Payslip layout' })).toBeInTheDocument());
    const lightLayout = screen.getAllByRole('radio', { name: 'Light' })[0];
    expect(lightLayout).toHaveAttribute('aria-checked', 'true');
    const boxed = screen.getByRole('radio', { name: 'Boxed' });
    expect(boxed).toHaveAttribute('aria-checked', 'true');
  });

  it('WHEN the template loads THEN a debounced preview call renders the server HTML', async () => {
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(mockApi.template.preview).toHaveBeenCalledWith(expect.objectContaining({ layout: 'light' })), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('payslip-preview')).toBeInTheDocument());
    expect(screen.getByTestId('payslip-preview').innerHTML).toContain('Sample payslip HTML');
  });

  it('WHEN the layout changes rapidly THEN only the settled template is previewed (debounce)', async () => {
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByRole('radiogroup', { name: 'Payslip layout' })).toBeInTheDocument());
    mockApi.template.preview.mockClear();
    fireEvent.click(screen.getAllByRole('radio', { name: 'Bubble' })[0]); // layout group renders first
    fireEvent.click(screen.getByRole('radio', { name: 'Wave' }));
    await waitFor(() => expect(mockApi.template.preview).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockApi.template.preview).toHaveBeenCalledWith(expect.objectContaining({ layout: 'wave' }));
  });

  it('WHEN a table style is selected THEN the preview reflects it', async () => {
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Striped' })).toBeInTheDocument());
    mockApi.template.preview.mockClear();
    fireEvent.click(screen.getByRole('radio', { name: 'Striped' }));
    await waitFor(() => expect(mockApi.template.preview).toHaveBeenCalledWith(expect.objectContaining({ table_style: 'striped' })), { timeout: 3000 });
  });

  it('WHEN branding fields change THEN each update flows into the template state', async () => {
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByPlaceholderText('https://…')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('https://…'), { target: { value: 'https://logo.png' } });
    fireEvent.change(screen.getByDisplayValue('Inter'), { target: { value: 'georgia' } });
    fireEvent.change(screen.getByDisplayValue('A4'), { target: { value: 'Letter' } });
    fireEvent.change(screen.getByPlaceholderText('This is a system-generated payslip.'), { target: { value: 'Confidential' } });
    mockApi.template.update.mockResolvedValue({ ...template, logo_url: 'https://logo.png' });
    fireEvent.click(screen.getByText('Save Template'));
    await waitFor(() => expect(mockApi.template.update).toHaveBeenCalledWith(expect.objectContaining({
      logo_url: 'https://logo.png',
      font: 'georgia',
      paper_format: 'Letter',
      footer_text: 'Confidential',
    })));
  });

  it('WHEN colors, address and tagline change THEN they are saved too', async () => {
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByText('Primary Color')).toBeInTheDocument());
    const colorInputs = Array.from(document.querySelectorAll('input[type="color"]'));
    fireEvent.change(colorInputs[0], { target: { value: '#123456' } });
    fireEvent.change(colorInputs[1], { target: { value: '#654321' } });
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '42 Industrial Estate' } });
    const taglineInput = screen.getByText('Tagline').parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(taglineInput, { target: { value: 'Pay on time' } });
    mockApi.template.update.mockResolvedValue(template);
    fireEvent.click(screen.getByText('Save Template'));
    await waitFor(() => expect(mockApi.template.update).toHaveBeenCalledWith(expect.objectContaining({
      primary_color: '#123456',
      secondary_color: '#654321',
      address: '42 Industrial Estate',
      tagline: 'Pay on time',
    })));
  });

  it('WHEN saving fails THEN the button returns to idle', async () => {
    mockApi.template.update.mockRejectedValue(new Error('nope'));
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByText('Save Template')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save Template'));
    await waitFor(() => expect(mockApi.template.update).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Save Template')).toBeInTheDocument());
  });

  it('WHEN the preview call fails THEN the last good preview (or placeholder) is kept', async () => {
    mockApi.template.preview.mockRejectedValue(new Error('render error'));
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(mockApi.template.preview).toHaveBeenCalled(), { timeout: 3000 });
    expect(screen.getByText(/Preview will appear here/)).toBeInTheDocument();
  });

  it('WHEN the template API fails THEN an unavailable message renders', async () => {
    mockApi.template.get.mockRejectedValue(new Error('down'));
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByText('Payslip template is not available yet.')).toBeInTheDocument());
  });
});

describe('GIVEN the payslip template preview Print / Download actions', () => {
  it('WHEN the preview has not loaded THEN Print and Download are disabled', async () => {
    mockApi.template.preview.mockImplementation(() => new Promise(() => {}));
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByText('Print')).toBeInTheDocument());
    expect(screen.getByText('Print').closest('button')).toBeDisabled();
    expect(screen.getByText('Download PDF').closest('button')).toBeDisabled();
  });

  it('WHEN Print is clicked THEN a print window opens with the preview HTML titled for the payslip', async () => {
    const printWindow = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, print: vi.fn(), focus: vi.fn(), onload: null as any };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow as any);
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByTestId('payslip-preview')).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.click(screen.getByText('Print'));

    expect(openSpy).toHaveBeenCalledWith('', '_blank', expect.stringContaining('noopener'));
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Payslip_PS-PREVIEW-0001'));
    openSpy.mockRestore();
  });

  it('WHEN Download PDF is clicked THEN it opens the same printable payslip window', async () => {
    const printWindow = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, print: vi.fn(), focus: vi.fn(), onload: null as any };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow as any);
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByTestId('payslip-preview')).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.click(screen.getByText('Download PDF'));

    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Payslip_PS-PREVIEW-0001'));
    openSpy.mockRestore();
  });

  it('WHEN pop-ups are blocked THEN a helpful error toast is shown instead of failing silently', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const toastErrorSpy = vi.spyOn(toast, 'error');
    render(<PayslipTemplateTab />);
    await waitFor(() => expect(screen.getByTestId('payslip-preview')).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.click(screen.getByText('Print'));

    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalledWith(expect.stringContaining('pop-ups')), { timeout: 3000 });
    openSpy.mockRestore();
    toastErrorSpy.mockRestore();
  });
});
