import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Printer, Download } from 'lucide-react';
import { toast, Select } from '@so360/design-system';
import { payrollApi, PayslipTemplate, PayslipLayout, PayslipTableStyle } from '../../../services/payrollApi';
import { openPrintableDocument, previewPayslipFileName } from '../../../utils/printableDocument';

const PREVIEW_PAYSLIP_NUMBER = 'PS-PREVIEW-0001';

const inputCls = 'w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary';
const labelCls = 'block text-xs text-fg-muted mb-1';

const LAYOUTS: { key: PayslipLayout; label: string }[] = [
    { key: 'light', label: 'Light' },
    { key: 'bubble', label: 'Bubble' },
    { key: 'wave', label: 'Wave' },
    { key: 'folder', label: 'Folder' },
    { key: 'center', label: 'Center' },
    { key: 'dual', label: 'Dual Column' },
    { key: 'lines', label: 'Lines' },
];

const TABLE_STYLES: { key: PayslipTableStyle; label: string }[] = [
    { key: 'light', label: 'Light' },
    { key: 'boxed', label: 'Boxed' },
    { key: 'bold', label: 'Bold' },
    { key: 'striped', label: 'Striped' },
    { key: 'bubble', label: 'Bubble' },
    { key: 'column', label: 'Column' },
];

const PayslipTemplateTab: React.FC = () => {
    const [template, setTemplate] = useState<PayslipTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        payrollApi.template.get()
            .then(setTemplate)
            .catch(() => toast.error('Failed to load payslip template'))
            .finally(() => setLoading(false));
    }, []);

    // Debounced live preview — server renders the trusted sample payslip HTML.
    const refreshPreview = useCallback((current: PayslipTemplate) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                setPreviewLoading(true);
                const result = await payrollApi.template.preview(current);
                setPreviewHtml(result.html);
            } catch {
                // Preview failure is non-fatal — keep the last good preview.
            } finally {
                setPreviewLoading(false);
            }
        }, 400);
    }, []);

    useEffect(() => {
        if (template) refreshPreview(template);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [template, refreshPreview]);

    const update = (patch: Partial<PayslipTemplate>) =>
        setTemplate(prev => (prev ? { ...prev, ...patch } : prev));

    const openPrintWindow = () => {
        if (!previewHtml) return;
        const opened = openPrintableDocument(previewHtml, previewPayslipFileName(PREVIEW_PAYSLIP_NUMBER));
        if (!opened) toast.error('Enable pop-ups to print or download the payslip');
    };

    const handleSave = async () => {
        if (!template) return;
        try {
            setSaving(true);
            const saved = await payrollApi.template.update(template);
            setTemplate(saved);
            toast.success('Payslip template saved');
        } catch {
            toast.error('Failed to save payslip template');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="h-64 bg-surface-raised/50 rounded-nb animate-pulse" />;
    if (!template) return <p className="text-sm text-fg-muted">Payslip template is not available yet.</p>;

    return (
        <div className="grid grid-cols-2 gap-5">
            {/* Controls */}
            <div className="space-y-5">
                <div>
                    <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">Layout</h4>
                    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payslip layout">
                        {LAYOUTS.map(layout => (
                            <button
                                key={layout.key}
                                role="radio"
                                aria-checked={template.layout === layout.key}
                                onClick={() => update({ layout: layout.key })}
                                className={`px-2 py-3 rounded-lg border text-xs font-medium transition-colors ${
                                    template.layout === layout.key
                                        ? 'bg-primary/10 border-primary/40 text-primary'
                                        : 'bg-surface border-line text-fg-muted hover:border-line-strong'
                                }`}
                            >
                                {layout.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">Table Style</h4>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payslip table style">
                        {TABLE_STYLES.map(style => (
                            <button
                                key={style.key}
                                role="radio"
                                aria-checked={template.table_style === style.key}
                                onClick={() => update({ table_style: style.key })}
                                className={`px-2 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                                    template.table_style === style.key
                                        ? 'bg-primary/10 border-primary/40 text-primary'
                                        : 'bg-surface border-line text-fg-muted hover:border-line-strong'
                                }`}
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Font</label>
                        <Select name="paysliptemplatetab-select-17" value={template.font || 'inter'} onChange={e => update({ font: e.target.value })} options={[{ value: "inter", label: "Inter" }, { value: "roboto", label: "Roboto" }, { value: "lato", label: "Lato" }, { value: "georgia", label: "Georgia" }, { value: "courier", label: "Courier" }]} />
                    </div>
                    <div>
                        <label className={labelCls}>Paper</label>
                        <Select name="paysliptemplatetab-select-18" value={template.paper_format || 'A4'} onChange={e => update({ paper_format: e.target.value as 'A4' | 'Letter' })} options={[{ value: "A4", label: "A4" }, { value: "Letter", label: "Letter" }]} />
                    </div>
                    <div>
                        <label className={labelCls}>Primary Color</label>
                        <input type="color" value={template.primary_color || '#0f766e'} onChange={e => update({ primary_color: e.target.value })} className="w-full h-10 px-2 py-1 bg-surface-raised border border-line-strong rounded-nb" />
                    </div>
                    <div>
                        <label className={labelCls}>Secondary Color</label>
                        <input type="color" value={template.secondary_color || '#334155'} onChange={e => update({ secondary_color: e.target.value })} className="w-full h-10 px-2 py-1 bg-surface-raised border border-line-strong rounded-nb" />
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className={labelCls}>Logo URL</label>
                        <input type="text" value={template.logo_url || ''} onChange={e => update({ logo_url: e.target.value })} className={inputCls} placeholder="https://…" />
                    </div>
                    <div>
                        <label className={labelCls}>Company Address</label>
                        <textarea value={template.address || ''} onChange={e => update({ address: e.target.value })} className={inputCls} rows={2} />
                    </div>
                    <div>
                        <label className={labelCls}>Tagline</label>
                        <input type="text" value={template.tagline || ''} onChange={e => update({ tagline: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Footer Text</label>
                        <input type="text" value={template.footer_text || ''} onChange={e => update({ footer_text: e.target.value })} className={inputCls} placeholder="This is a system-generated payslip." />
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        <Save size={14} /> {saving ? 'Saving…' : 'Save Template'}
                    </button>
                </div>
            </div>

            {/* Live preview */}
            <div className="bg-surface border border-line rounded-nb overflow-hidden">
                <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-fg">Live Preview</h4>
                    <div className="flex items-center gap-3">
                        {previewLoading && <span className="text-xs text-fg-subtle">Refreshing…</span>}
                        <button
                            type="button"
                            onClick={openPrintWindow}
                            disabled={!previewHtml}
                            className="flex items-center gap-1.5 text-xs font-medium text-fg hover:text-primary disabled:opacity-40 disabled:hover:text-fg transition-colors"
                        >
                            <Printer size={13} /> Print
                        </button>
                        <button
                            type="button"
                            onClick={openPrintWindow}
                            disabled={!previewHtml}
                            className="flex items-center gap-1.5 text-xs font-medium text-fg hover:text-primary disabled:opacity-40 disabled:hover:text-fg transition-colors"
                        >
                            <Download size={13} /> Download PDF
                        </button>
                    </div>
                </div>
                <div className="p-4 bg-surface-raised/30 min-h-96 overflow-auto">
                    {previewHtml ? (
                        // Server-rendered trusted HTML from the people-connect backend's
                        // own template renderer — never user-supplied markup.
                        <div
                            data-testid="payslip-preview"
                            className="bg-white rounded-nb shadow-xl"
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                    ) : (
                        <p className="text-sm text-fg-subtle text-center py-16">Preview will appear here as you customize the template.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayslipTemplateTab;
