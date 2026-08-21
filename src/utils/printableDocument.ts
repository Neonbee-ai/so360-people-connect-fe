/**
 * Opens server-rendered, self-contained payslip HTML in a dedicated print
 * window and triggers the browser's native print dialog. This yields a real,
 * selectable, vector PDF via "Save as PDF" — never a screenshot/image export
 * — because the payslip HTML already carries all its own inline styling and
 * no application chrome (see PayslipsService.renderPayslipHtml on the BE).
 *
 * The window's document `title` seeds the filename the browser's print/save
 * dialog suggests, so callers pass the desired payslip filename (without
 * extension) as `fileNameNoExt`.
 */
export function openPrintableDocument(
    html: string,
    fileNameNoExt: string,
    autoPrint = true,
): Window | null {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1150');
    if (!printWindow) return null;

    const titleTag = `<title>${escapeHtml(fileNameNoExt)}</title>`;
    let titled: string;
    if (/<title>.*?<\/title>/i.test(html)) {
        titled = html.replace(/<title>.*?<\/title>/i, titleTag);
    } else if (/<head[^>]*>/i.test(html)) {
        titled = html.replace(/<head[^>]*>/i, match => `${match}${titleTag}`);
    } else if (/<html[^>]*>/i.test(html)) {
        titled = html.replace(/<html[^>]*>/i, match => `${match}<head>${titleTag}</head>`);
    } else {
        titled = `<!doctype html><html><head>${titleTag}</head><body>${html}</body></html>`;
    }

    printWindow.document.open();
    printWindow.document.write(titled);
    printWindow.document.close();

    if (autoPrint) {
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
        // Some browsers (already-loaded blank docs) never fire `load` for
        // document.write content — fall back to a short delay.
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 300);
    }

    return printWindow;
}

function escapeHtml(v: string): string {
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Builds the standard payslip preview filename, e.g. Payslip_PS-PREVIEW-0001. */
export function previewPayslipFileName(payslipNumber: string): string {
    return `Payslip_${payslipNumber}`;
}

/** Builds the standard employee payslip filename, e.g. Payslip_Asha_Nair_August-2026. */
export function employeePayslipFileName(employeeName: string, periodEnd: string): string {
    const monthYear = new Date(`${periodEnd}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
    const safeName = employeeName.trim().replace(/\s+/g, '_');
    return `Payslip_${safeName}_${monthYear.replace(' ', '-')}`;
}
