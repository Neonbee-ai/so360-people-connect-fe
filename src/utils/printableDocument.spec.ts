import { describe, it, expect, vi } from 'vitest';
import { openPrintableDocument, previewPayslipFileName, employeePayslipFileName } from './printableDocument';

describe('GIVEN previewPayslipFileName', () => {
  it('WHEN given a payslip number THEN it prefixes it for the download filename', () => {
    expect(previewPayslipFileName('PS-PREVIEW-0001')).toBe('Payslip_PS-PREVIEW-0001');
  });
});

describe('GIVEN employeePayslipFileName', () => {
  it('WHEN given a name and period end THEN it builds Payslip_<Name>_<Month-Year>', () => {
    expect(employeePayslipFileName('Asha Nair', '2026-08-31')).toBe('Payslip_Asha_Nair_August-2026');
  });
});

describe('GIVEN openPrintableDocument', () => {
  it('WHEN a print window is available THEN it writes the retitled HTML and calls print', () => {
    vi.useFakeTimers();
    const printWindow = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, print: vi.fn(), focus: vi.fn(), onload: null as any };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow as any);

    const result = openPrintableDocument('<html><head><title>old</title></head><body>slip</body></html>', 'Payslip_PS-1');

    expect(result).toBe(printWindow);
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('<title>Payslip_PS-1</title>'));
    expect(printWindow.document.write).not.toHaveBeenCalledWith(expect.stringContaining('<title>old</title>'));

    vi.advanceTimersByTime(300);
    expect(printWindow.print).toHaveBeenCalled();

    openSpy.mockRestore();
    vi.useRealTimers();
  });

  it('WHEN the popup is blocked THEN it returns null without throwing', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openPrintableDocument('<html></html>', 'x')).toBeNull();
    openSpy.mockRestore();
  });

  it('WHEN autoPrint is false THEN print() is never invoked', () => {
    vi.useFakeTimers();
    const printWindow = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, print: vi.fn(), focus: vi.fn(), onload: null as any };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow as any);

    openPrintableDocument('<html><head></head></html>', 'x', false);
    vi.advanceTimersByTime(1000);

    expect(printWindow.print).not.toHaveBeenCalled();
    openSpy.mockRestore();
    vi.useRealTimers();
  });
});
