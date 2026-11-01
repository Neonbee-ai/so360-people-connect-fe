import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Printer, Download } from 'lucide-react';
import {
    toast, Button, Card, ColorPicker, EmptyState, FieldGrid, Grid, RadioGroup, Select, Skeleton, Stack, TextField, Textarea, Cluster,
} from '@so360/design-system';
import { payrollApi, PayslipTemplate, PayslipLayout, PayslipTableStyle } from '../../../services/payrollApi';
import { openPrintableDocument, previewPayslipFileName } from '../../../utils/printableDocument';

const PREVIEW_PAYSLIP_NUMBER = 'PS-PREVIEW-0001';

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

    if (loading) return <Skeleton variant="text" lines={6} />;
    if (!template) return <EmptyState title="Payslip template is not available yet." />;

    return (
        <Grid columns={2} gap="md">
            {/* Controls */}
            <Stack>
                <RadioGroup
                    name="payslip-layout"
                    label="Payslip layout"
                    orientation="horizontal"
                    options={LAYOUTS.map(l => ({ value: l.key, label: l.label }))}
                    value={template.layout}
                    onChange={v => update({ layout: v as PayslipLayout })}
                />
                <RadioGroup
                    name="payslip-table-style"
                    label="Payslip table style"
                    orientation="horizontal"
                    options={TABLE_STYLES.map(t => ({ value: t.key, label: t.label }))}
                    value={template.table_style}
                    onChange={v => update({ table_style: v as PayslipTableStyle })}
                />

                <FieldGrid columns={2}>
                    <Select name="payslip-font" label="Font" value={template.font || 'inter'} onChange={e => update({ font: e.target.value })} options={[{ value: 'inter', label: 'Inter' }, { value: 'roboto', label: 'Roboto' }, { value: 'lato', label: 'Lato' }, { value: 'georgia', label: 'Georgia' }, { value: 'courier', label: 'Courier' }]} />
                    <Select name="payslip-paper" label="Paper" value={template.paper_format || 'A4'} onChange={e => update({ paper_format: e.target.value as 'A4' | 'Letter' })} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }]} />
                    <ColorPicker name="payslip-primary-color" label="Primary Color" value={template.primary_color || '#0f766e'} onChange={v => update({ primary_color: v })} />
                    <ColorPicker name="payslip-secondary-color" label="Secondary Color" value={template.secondary_color || '#334155'} onChange={v => update({ secondary_color: v })} />
                </FieldGrid>

                <Stack gap="tight">
                    <TextField name="payslip-logo-url" label="Logo URL" value={template.logo_url || ''} onChange={e => update({ logo_url: e.target.value })} placeholder="https://…" />
                    <Textarea name="payslip-address" label="Company Address" rows={2} value={template.address || ''} onChange={e => update({ address: e.target.value })} />
                    <TextField name="payslip-tagline" label="Tagline" value={template.tagline || ''} onChange={e => update({ tagline: e.target.value })} />
                    <TextField name="payslip-footer-text" label="Footer Text" value={template.footer_text || ''} onChange={e => update({ footer_text: e.target.value })} placeholder="This is a system-generated payslip." />
                </Stack>

                <Cluster justify="end">
                    <Button onClick={handleSave} disabled={saving}>
                        <Save size={14} /> {saving ? 'Saving…' : 'Save Template'}
                    </Button>
                </Cluster>
            </Stack>

            {/* Live preview */}
            <Card
                title="Live Preview"
                actions={(
                    <Cluster>
                        {previewLoading && <span className="text-nb-caption text-fg-subtle">Refreshing…</span>}
                        <Button variant="ghost" size="sm" onClick={openPrintWindow} disabled={!previewHtml}>
                            <Printer size={13} /> Print
                        </Button>
                        <Button variant="ghost" size="sm" onClick={openPrintWindow} disabled={!previewHtml}>
                            <Download size={13} /> Download PDF
                        </Button>
                    </Cluster>
                )}
            >
                {previewHtml ? (
                    // Server-rendered trusted HTML from the people-connect backend's
                    // own template renderer — never user-supplied markup.
                    <div
                        data-testid="payslip-preview"
                        className="bg-surface rounded-nb"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                ) : (
                    <p className="text-nb-body text-fg-subtle text-center">Preview will appear here as you customize the template.</p>
                )}
            </Card>
        </Grid>
    );
};

export default PayslipTemplateTab;
